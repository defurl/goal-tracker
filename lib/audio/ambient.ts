// The ambient bed — design-system/08 §7, spec/05 §3, build plan 3.8.
//
// A lo-fi bed at 0.3 gain, a distant room hum, occasional weather. Synthesised
// entirely, so there are no audio files to fetch or license.
//
// Tone.js is imported the first time the bed is wanted, never before: it
// stays out of both bundle budgets, and the AudioContext it needs is created
// inside the click that asked for sound, which is the only moment a browser
// lets audio start. Nothing here runs on first paint.
//
// Browser-only; the one caller is a client component.

type ToneModule = typeof import('tone');

/** spec/05 §3: `focusMode` maps to ambient gain 0 → 0.3 over 600 ms. */
export const BED_GAIN = 0.3;
export const FADE_MS = 600;

interface Bed {
  setOn(on: boolean): void;
}

let bed: Promise<Bed> | null = null;

/** A four-chord loop in the lo-fi register: maj7s and min7s, low and open. */
const CHORDS = [
  ['C3', 'E3', 'G3', 'B3'],
  ['A2', 'C3', 'E3', 'G3'],
  ['F2', 'A2', 'C3', 'E3'],
  ['G2', 'B2', 'D3', 'F3'],
];

async function build(): Promise<Bed> {
  const Tone: ToneModule = await import('tone');
  await Tone.start();

  const master = new Tone.Gain(0).toDestination();

  // Room tone and rain: brown noise, low-passed until it is weather, not hiss.
  const room = new Tone.Noise('brown');
  room.chain(new Tone.Filter(520, 'lowpass'), new Tone.Gain(0.32), master);

  // A distant hum, a fifth apart and barely there.
  const hum = new Tone.Oscillator(55, 'sine');
  const humFifth = new Tone.Oscillator(82.4, 'sine');
  const humGain = new Tone.Gain(0.05).connect(master);
  hum.connect(humGain);
  humFifth.connect(new Tone.Gain(0.4).connect(humGain));

  // The bed: soft triangles, slow attack, filtered and set back in the room.
  const reverb = new Tone.Reverb({ decay: 6, wet: 0.45 });
  await reverb.generate();
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 3, decay: 1, sustain: 0.6, release: 5 },
  });
  pad.volume.value = -20;
  pad.chain(new Tone.Filter(900, 'lowpass'), reverb, master);

  const transport = Tone.getTransport();
  let chord = 0;
  const loop = new Tone.Loop((time) => {
    pad.triggerAttackRelease(CHORDS[chord % CHORDS.length]!, 6, time, 0.5);
    chord++;
  }, 8);

  // Weather: now and then a gust — pink noise swept through a band-pass.
  const gust = new Tone.Noise('pink');
  const gustFilter = new Tone.Filter(700, 'bandpass');
  const gustGain = new Tone.Gain(0);
  gust.chain(gustFilter, gustGain, master);
  const scheduleGust = (from: number) => {
    transport.scheduleOnce(
      (time) => {
        gustGain.gain.setValueAtTime(0, time);
        gustGain.gain.linearRampToValueAtTime(0.12, time + 3);
        gustGain.gain.linearRampToValueAtTime(0, time + 8);
        gustFilter.frequency.setValueAtTime(500, time);
        gustFilter.frequency.linearRampToValueAtTime(1100, time + 5);
        scheduleGust(transport.seconds);
      },
      from + 20 + Math.random() * 25,
    );
  };

  const sources = [room, hum, humFifth, gust];
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    setOn(on) {
      if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }
      if (on) {
        for (const s of sources) if (s.state !== 'started') s.start();
        if (transport.state !== 'started') {
          loop.start(0);
          scheduleGust(0);
          transport.start();
        }
        master.gain.rampTo(BED_GAIN, FADE_MS / 1000);
        return;
      }
      master.gain.rampTo(0, FADE_MS / 1000);
      // Silence costs CPU too: once the fade is done, stop everything.
      stopTimer = setTimeout(() => {
        for (const s of sources) if (s.state === 'started') s.stop();
        loop.stop();
        transport.stop();
        transport.cancel();
      }, FADE_MS + 100);
    },
  };
}

/** Fade the bed in or out. The first call loads Tone.js and builds the graph. */
export async function setAmbient(on: boolean): Promise<void> {
  if (!on && !bed) return; // never loaded, nothing to silence
  bed ??= build();
  try {
    (await bed).setOn(on);
  } catch {
    // No audio device, or the browser refused the context: stay silent. The
    // toggle still reads its state; nothing in the room depends on sound.
    bed = null;
  }
}
