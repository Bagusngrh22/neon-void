// Synthesized sound: every effect is an oscillator + gain envelope built
// with WebAudio, and the music is a tiny looping bass/arpeggio sequencer.
// No audio files, no network. AudioContext is created lazily on the first
// user gesture so browsers' autoplay rules are respected.

const MUSIC_BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];
const MUSIC_ARP = [220, 277.18, 329.63, 440, 329.63, 277.18, 220, 164.81];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let stepIndex = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
  }

  function musicStep() {
    if (!ctx || muted) return;
    const bass = MUSIC_BASS[stepIndex % MUSIC_BASS.length];
    if (bass) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = bass;
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    }
    const arp = MUSIC_ARP[stepIndex % MUSIC_ARP.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = arp;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    stepIndex += 1;
  }

  return {
    /** Call from any user gesture; also (re)starts the music loop. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!musicTimer) musicTimer = window.setInterval(musicStep, 190);
    },
    shoot() { tone(880, 0.08, 'square', 0.10, 220); },
    enemyShoot() { tone(320, 0.12, 'sawtooth', 0.06, 140); },
    explosion(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1400);
      tone(big ? 160 : 220, big ? 0.4 : 0.2, 'sine', 0.35, 40);
    },
    hit() { tone(200, 0.06, 'sawtooth', 0.12, 90); },
    powerup() {
      tone(523.25, 0.1, 'sine', 0.2);
      window.setTimeout(() => tone(783.99, 0.14, 'sine', 0.2), 90);
    },
    waveClear() {
      [523.25, 659.25, 783.99].forEach((f, i) => window.setTimeout(() => tone(f, 0.16, 'triangle', 0.22), i * 110));
    },
    gameOver() {
      [392, 311.13, 233.08, 155.56].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'triangle', 0.22), i * 180));
    },
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
