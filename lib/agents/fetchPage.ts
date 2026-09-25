// Fetches a user-supplied article URL without letting it reach anything but the
// public web — spec/04-ai-agents.md §2, all three guards:
//
//   timeout     8 s for the whole fetch, redirects included
//   refuse      non-HTML content types
//   SSRF        never connect to, or redirect to, a private address
//
// node:http rather than fetch(): fetch resolves DNS where this code cannot see
// it, so it can only check a hostname, and a hostname check loses to a DNS
// record pointing at 127.0.0.1 — or to one that changes between the check and
// the connect. Here the guard runs inside `lookup`, on the exact address the
// socket then connects to. Redirects are followed by hand so every hop is
// checked the same way.

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

import { isPublicAddress } from './ssrf.ts';

export type PageFetchErrorCode = 'INVALID_URL' | 'BLOCKED' | 'TIMEOUT' | 'NOT_HTML' | 'HTTP_ERROR' | 'NETWORK';

export class PageFetchError extends Error {
  readonly code: PageFetchErrorCode;

  constructor(code: PageFetchErrorCode) {
    super(code);
    this.name = 'PageFetchError';
    this.code = code;
  }
}

export const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
/** Decompressed. Readability only needs the article, and the model gets 6000 chars of it. */
const MAX_BYTES = 2 * 1024 * 1024;
const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

type Resolve = (
  hostname: string,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

/**
 * What the fetch may reach. The defaults ARE the guard; the route never passes
 * options. They exist so a test can point the fetch at a local server — which
 * the defaults refuse, correctly — and still watch every other refusal work.
 */
export interface FetchPageOptions {
  isAllowedAddress?: (ip: string) => boolean;
  /** '' is the scheme's default port. */
  allowedPorts?: readonly string[];
  resolve?: Resolve;
  timeoutMs?: number;
}

interface Policy {
  isAllowedAddress: (ip: string) => boolean;
  allowedPorts: readonly string[];
  resolve: Resolve;
}

const systemResolve: Resolve = (hostname, callback) => {
  dnsLookup(hostname, { all: true }, callback);
};

/** A URL the fetch may even attempt: http(s), default ports, no credentials. */
function checkUrl(raw: string, policy: Policy, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    throw new PageFetchError('INVALID_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new PageFetchError('INVALID_URL');
  if (url.username || url.password) throw new PageFetchError('INVALID_URL');
  // Non-default ports are where internal services live; articles are on 80/443.
  if (!policy.allowedPorts.includes(url.port)) throw new PageFetchError('BLOCKED');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !policy.isAllowedAddress(host)) throw new PageFetchError('BLOCKED');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new PageFetchError('BLOCKED');
  return url;
}

/**
 * The DNS step, with the guard inside it. Every address a name resolves to must
 * be allowed: if a name offers both a public and a private address, the socket
 * could pick either, so the name is refused.
 */
function guardedLookup(policy: Policy): LookupFunction {
  return (hostname, options, callback) => {
    policy.resolve(hostname, (error, addresses) => {
      if (error) {
        callback(error, '', 0);
        return;
      }
      const list = Array.isArray(addresses) ? addresses : [];
      if (list.length === 0 || !list.every((a) => policy.isAllowedAddress(a.address))) {
        callback(new PageFetchError('BLOCKED'), '', 0);
        return;
      }
      if (options.all) {
        (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
      } else {
        const first = list[0] as LookupAddress;
        callback(null, first.address, first.family);
      }
    });
  };
}

function get(url: URL, policy: Policy, signal: AbortSignal): Promise<IncomingMessage> {
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = send(
      url,
      {
        method: 'GET',
        lookup: guardedLookup(policy),
        signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'BeBetterEveryday/1.0 (+article-to-action)',
        },
      },
      resolve,
    );
    req.on('error', reject);
    req.end();
  });
}

async function readBody(response: IncomingMessage): Promise<Buffer> {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
  const stream =
    encoding === 'gzip'
      ? response.pipe(createGunzip())
      : encoding === 'deflate'
        ? response.pipe(createInflate())
        : encoding === 'br'
          ? response.pipe(createBrotliDecompress())
          : response;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const remaining = MAX_BYTES - size;
    if (chunk.length >= remaining) {
      // Enough of the page; the lead is what the model reads anyway.
      chunks.push(chunk.subarray(0, remaining));
      response.destroy();
      break;
    }
    chunks.push(chunk);
    size += chunk.length;
  }
  return Buffer.concat(chunks);
}

function charsetOf(contentType: string): string {
  const match = /charset=["']?([\w-]+)/i.exec(contentType);
  const label = match?.[1]?.toLowerCase() ?? 'utf-8';
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return 'utf-8';
  }
}

function classify(error: unknown, signal: AbortSignal): PageFetchError {
  if (error instanceof PageFetchError) return error;
  if (signal.aborted) return new PageFetchError('TIMEOUT');
  // The guard's refusal arrives wrapped by the socket layer on some Node versions.
  if (error instanceof Error && error.message === 'BLOCKED') return new PageFetchError('BLOCKED');
  return new PageFetchError('NETWORK');
}

export async function fetchPage(
  rawUrl: string,
  options: FetchPageOptions = {},
): Promise<{ html: string; finalUrl: string }> {
  const policy: Policy = {
    isAllowedAddress: options.isAllowedAddress ?? isPublicAddress,
    allowedPorts: options.allowedPorts ?? ['', '80', '443'],
    resolve: options.resolve ?? systemResolve,
  };
  const signal = AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS);
  let url = checkUrl(rawUrl, policy);

  try {
    for (let hop = 0; ; hop++) {
      const response = await get(url, policy, signal);
      const status = response.statusCode ?? 0;

      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (hop >= MAX_REDIRECTS) throw new PageFetchError('HTTP_ERROR');
        url = checkUrl(response.headers.location, policy, url);
        continue;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        throw new PageFetchError('HTTP_ERROR');
      }

      const contentType = String(response.headers['content-type'] ?? '');
      if (!HTML_TYPES.some((t) => contentType.toLowerCase().startsWith(t))) {
        response.destroy();
        throw new PageFetchError('NOT_HTML');
      }

      const body = await readBody(response);
      return { html: new TextDecoder(charsetOf(contentType)).decode(body), finalUrl: url.toString() };
    }
  } catch (error) {
    throw classify(error, signal);
  }
}
