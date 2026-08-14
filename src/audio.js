export class AudioEngine {
  constructor(volume = .65) {
    this.volume = volume;
    this.context = null;
    this.master = null;
    this.lastHit = 0;
  }

  start() {
    if (this.context) return this.context.resume();
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume * .45;
    this.master.connect(this.context.destination);
    this.ambience();
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.setTargetAtTime(value * .45, this.context.currentTime, .04);
  }

  tone({ frequency = 220, end = frequency, duration = .08, gain = .08, type = 'sine', delay = 0 }) {
    if (!this.context || !this.volume) return;
    const time = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), time + duration);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + duration + .02);
  }

  ambience() {
    const ctx = this.context;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.value = .024;
    filter.connect(gain).connect(this.master);
    [55, 82.4, 110].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 5 - 4;
      oscillator.connect(filter);
      oscillator.start();
    });
    const lfo = ctx.createOscillator();
    const amount = ctx.createGain();
    lfo.frequency.value = .08;
    amount.gain.value = .012;
    lfo.connect(amount).connect(gain.gain);
    lfo.start();
  }

  shoot() { this.tone({ frequency: 430, end: 170, duration: .055, gain: .025, type: 'triangle' }); }
  dash() { this.tone({ frequency: 130, end: 760, duration: .11, gain: .07, type: 'sawtooth' }); }
  pulse() { this.tone({ frequency: 80, end: 260, duration: .38, gain: .11, type: 'sine' }); }
  pickup() { this.tone({ frequency: 580, end: 880, duration: .05, gain: .018, type: 'sine' }); }
  hurt() { this.tone({ frequency: 170, end: 54, duration: .18, gain: .11, type: 'sawtooth' }); }
  click() { this.tone({ frequency: 340, end: 280, duration: .045, gain: .035, type: 'square' }); }

  hit() {
    const now = performance.now();
    if (now - this.lastHit < 35) return;
    this.lastHit = now;
    this.tone({ frequency: 120, end: 70, duration: .04, gain: .025, type: 'square' });
  }

  level() {
    [330, 440, 660].forEach((frequency, index) => this.tone({ frequency, end: frequency * 1.04, duration: .18, gain: .05, type: 'triangle', delay: index * .07 }));
  }

  boss() {
    [74, 62, 49].forEach((frequency, index) => this.tone({ frequency, end: frequency * .65, duration: .65, gain: .12, type: 'sawtooth', delay: index * .13 }));
  }

  victory() {
    [220, 277, 330, 440].forEach((frequency, index) => this.tone({ frequency, end: frequency * 1.01, duration: .36, gain: .06, type: 'triangle', delay: index * .12 }));
  }
}
