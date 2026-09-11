// Adapted from Hiraeth010/blackwater (MIT). See LICENSE in this directory.
export class Soundscape {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  rain: AudioBufferSourceNode | null = null;
  muted = false;
  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const C = window.AudioContext;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.42;
    this.master.connect(this.ctx.destination);
    const b = this.ctx.createBuffer(
      1,
      this.ctx.sampleRate * 3,
      this.ctx.sampleRate,
    );
    let d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.rain = this.ctx.createBufferSource();
    this.rain.buffer = b;
    this.rain.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    this.rain.connect(filter).connect(g).connect(this.master);
    this.rain.start();
  }
  setMute(v: boolean) {
    this.muted = v;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        v ? 0 : 0.42,
        this.ctx.currentTime,
        0.07,
      );
  }
  noise(duration: number, volume: number, frequency: number) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx,
      b = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp((-i / d.length) * 7);
    const s = c.createBufferSource();
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = frequency;
    const g = c.createGain();
    g.gain.value = volume;
    s.connect(f).connect(g).connect(this.master);
    s.start();
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  tone(f: number, duration: number, volume: number, to = 0) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, c.currentTime);
    if (to)
      o.frequency.exponentialRampToValueAtTime(to, c.currentTime + duration);
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  shot(enemy = false) {
    this.noise(0.23, enemy ? 0.3 : 0.85, enemy ? 1300 : 4800);
    this.tone(enemy ? 90 : 140, 0.17, enemy ? 0.08 : 0.3, 35);
  }
  hit() {
    this.tone(1400, 0.045, 0.06, 900);
  }
  step() {
    this.noise(0.12, 0.13, 700);
  }
  reload() {
    this.noise(0.17, 0.18, 3900);
    this.tone(270, 0.08, 0.025, 110);
  }
  dispose() {
    this.rain?.stop();
    void this.ctx?.close();
  }
}
