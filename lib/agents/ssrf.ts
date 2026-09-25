// Which addresses a user-supplied URL may reach — spec/04-ai-agents.md §2.
//
// Accepting a URL and fetching it server-side is SSRF by default: the server
// sits inside a network the user does not, and "fetch this" becomes "fetch our
// metadata endpoint". Loopback, link-local and RFC1918 are named in the spec;
// the rest of the special-purpose ranges below are refused for the same reason
// — none of them is a public web page.
//
// Checked against the address actually connected to, after DNS, by
// fetchPage.ts — a hostname check alone loses to a record that resolves to
// 127.0.0.1.

import { isIP } from 'node:net';

type Cidr4 = readonly [number, number, number, number, number];

/** IPv4 special-purpose ranges (RFC 6890 and friends). */
const BLOCKED_V4: readonly Cidr4[] = [
  [0, 0, 0, 0, 8], // "this network"
  [10, 0, 0, 0, 8], // RFC1918
  [100, 64, 0, 0, 10], // carrier-grade NAT
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local — includes cloud metadata at .169.254
  [172, 16, 0, 0, 12], // RFC1918
  [192, 0, 0, 0, 24], // IETF protocol assignments
  [192, 0, 2, 0, 24], // documentation
  [192, 88, 99, 0, 24], // 6to4 relay anycast
  [192, 168, 0, 0, 16], // RFC1918
  [198, 18, 0, 0, 15], // benchmarking
  [198, 51, 100, 0, 24], // documentation
  [203, 0, 113, 0, 24], // documentation
  [224, 0, 0, 0, 4], // multicast
  [240, 0, 0, 0, 4], // reserved, and broadcast
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

function isPublicV4(ip: string): boolean {
  const value = v4ToInt(ip);
  if (value === null) return false;
  return !BLOCKED_V4.some(([a, b, c, d, bits]) => {
    const base = ((a * 256 + b) * 256 + c) * 256 + d;
    const size = 2 ** (32 - bits);
    return value >= base && value < base + size;
  });
}

/** Eight 16-bit groups, or null. Accepts :: compression and a dotted-quad tail. */
function v6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf('%');
  if (zone !== -1) text = text.slice(0, zone);

  // A trailing dotted quad (::ffff:10.0.0.1) becomes two groups.
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail?.[1]) {
    const v4 = v4ToInt(tail[1]);
    if (v4 === null) return null;
    text = `${text.slice(0, -tail[1].length)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (s: string) => (s === '' ? [] : s.split(':'));
  const head = parse(halves[0] ?? '');
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out.length === 8 ? out : null;
}

function embeddedV4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isPublicV6(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return false;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;

  if (g.every((x) => x === 0)) return false; // ::
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return false; // ::1 loopback
  }
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): judge the IPv4.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) {
    return isPublicV4(embeddedV4(g6, g7));
  }
  if (g0 === 0x64 && g1 === 0xff9b) return isPublicV4(embeddedV4(g6, g7)); // NAT64
  if (g0 === 0x2002) return isPublicV4(embeddedV4(g1, g2)); // 6to4
  if ((g0 & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return false; // fec0::/10 site-local (deprecated)
  if ((g0 & 0xff00) === 0xff00) return false; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return false; // discard
  return true;
}

/** True only for an address a public web page could live at. Anything unparseable is false. */
export function isPublicAddress(ip: string): boolean {
  const bare = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
  const family = isIP(bare.split('%')[0] ?? '');
  if (family === 4) return isPublicV4(bare);
  if (family === 6) return isPublicV6(bare);
  return false;
}
