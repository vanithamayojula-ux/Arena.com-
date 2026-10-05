class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxVolNode: GainNode | null = null;
  private musicVolNode: GainNode | null = null;
  private masterVolNode: GainNode | null = null;
  
  private musicIntervalId: any = null;
  private isMusicPlaying = false;
  private tempo = 115; // BPM
  private currentStep = 0;

  // Sound settings
  private sfxVolume = 0.6;
  private musicVolume = 0.35;
  private isMuted = false;

  constructor() {
    // Lazy loaded on first user interaction
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      
      this.masterVolNode = this.ctx.createGain();
      this.masterVolNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterVolNode.connect(this.ctx.destination);

      this.sfxVolNode = this.ctx.createGain();
      this.sfxVolNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxVolNode.connect(this.masterVolNode);

      this.musicVolNode = this.ctx.createGain();
      this.musicVolNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicVolNode.connect(this.masterVolNode);
    } catch (e) {
      console.error("Failed to initialize Web Audio API", e);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.resume();
    if (this.sfxVolNode && this.ctx) {
      this.sfxVolNode.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    this.resume();
    if (this.musicVolNode && this.ctx) {
      this.musicVolNode.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.resume();
    if (this.masterVolNode && this.ctx) {
      this.masterVolNode.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  getSettings() {
    return {
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      isMuted: this.isMuted
    };
  }

  playKeypress(isCorrect: boolean) {
    this.resume();
    if (!this.ctx || !this.sfxVolNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxVolNode);

    if (isCorrect) {
      // High pitch quick laser "pew"
      osc.type = "sine";
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      // Short blunt buzz for errors
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.12);

      // Low pass filter to make it thicker
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(350, now);
      
      osc.disconnect(gain);
      osc.connect(filter);
      filter.connect(gain);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  playWordDestroy(isBoss: boolean = false) {
    this.resume();
    if (!this.ctx || !this.sfxVolNode) return;

    const now = this.ctx.currentTime;
    const duration = isBoss ? 0.6 : 0.25;

    // Synthesize explosion via noise + decaying low pass filter
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isBoss ? 200 : 400, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isBoss ? 0.45 : 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolNode);

    noiseNode.start(now);
    noiseNode.stop(now + duration);

    // Add a sine sub-bass thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(isBoss ? 90 : 120, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + duration);

    subGain.gain.setValueAtTime(isBoss ? 0.5 : 0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(this.sfxVolNode);

    subOsc.start(now);
    subOsc.stop(now + duration);

    // If it's a boss, play a triumph major synth flourish as well!
    if (isBoss) {
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, index) => {
        const leadOsc = this.ctx!.createOscillator();
        const leadGain = this.ctx!.createGain();
        leadOsc.type = "triangle";
        leadOsc.frequency.setValueAtTime(freq, now + index * 0.08);
        
        leadGain.gain.setValueAtTime(0, now);
        leadGain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.02);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);
        
        leadOsc.connect(leadGain);
        leadGain.connect(this.sfxVolNode!);
        leadOsc.start(now + index * 0.08);
        leadOsc.stop(now + index * 0.08 + 0.3);
      });
    }
  }

  playPowerup() {
    this.resume();
    if (!this.ctx || !this.sfxVolNode) return;

    const now = this.ctx.currentTime;
    // Ascending laser slides (cyber chime)
    const freqs = [330, 440, 554, 660, 880]; // A major progression
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + idx * 0.06 + 0.1);
      
      gain.gain.setValueAtTime(0.08, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12);
      
      osc.connect(gain);
      gain.connect(this.sfxVolNode!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  }

  playShieldDamage() {
    this.resume();
    if (!this.ctx || !this.sfxVolNode) return;

    const now = this.ctx.currentTime;
    // Heavy crunch/metallic crash
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(180, now);
    filter.Q.setValueAtTime(4, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolNode);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.36);

    // Screen hit rumble noise
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(noiseGain);
    noiseGain.connect(this.sfxVolNode);
    noise.start(now);
    noise.stop(now + 0.26);
  }

  playBossWarning() {
    this.resume();
    if (!this.ctx || !this.sfxVolNode) return;

    const now = this.ctx.currentTime;
    // Klaxon siren (twice)
    for (let i = 0; i < 2; i++) {
      const delay = i * 0.45;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now + delay);
      osc.frequency.linearRampToValueAtTime(320, now + delay + 0.35);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now + delay);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxVolNode);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);

      osc.start(now + delay);
      osc.stop(now + delay + 0.41);
    }
  }

  playGameOver() {
    this.resume();
    if (!this.ctx || !this.sfxVolNode) return;

    const now = this.ctx.currentTime;
    // Sad falling sliding notes
    const baseFreqs = [220, 196, 174, 146]; // A3, G3, F3, D3
    baseFreqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.2);
      osc.frequency.linearRampToValueAtTime(freq * 0.8, now + idx * 0.2 + 0.22);
      
      gain.gain.setValueAtTime(0.12, now + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + 0.22);
      
      osc.connect(gain);
      gain.connect(this.sfxVolNode!);
      osc.start(now + idx * 0.2);
      osc.stop(now + idx * 0.2 + 0.25);
    });
  }

  // Sequenced looping synth music wave!
  // To keep it clean and robust, we build a 16-step grid synthwave bassline.
  // Play minor retro pattern: Am - F - C - G
  startMusic() {
    this.resume();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.currentStep = 0;

    const stepDuration = 60 / this.tempo / 2; // 8th notes (approx 0.26s at 115 BPM)
    
    const scheduleNextBeats = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.musicVolNode) return;

      const now = this.ctx.currentTime;

      // Base chord progression frequencies
      // Chord 1 (Am): A1 (55Hz), A2 (110Hz)
      // Chord 2 (F):  F1 (43.65Hz), F2 (87.3Hz)
      // Chord 3 (C):  C1 (32.7Hz), C2 (65.41Hz)
      // Chord 4 (G):  G1 (49Hz), G2 (98Hz)
      
      const bassRoots = [
        // Measure 1: Am (A)
        55.0, 55.0, 110.0, 55.0, 55.0, 110.0, 55.0, 110.0,
        // Measure 2: F
        43.65, 43.65, 87.3, 43.65, 43.65, 87.3, 43.65, 87.3,
        // Measure 3: C
        65.41, 65.41, 130.82, 65.41, 65.41, 130.82, 65.41, 130.82,
        // Measure 4: G
        49.0, 49.0, 98.0, 49.0, 49.0, 98.0, 49.0, 98.0
      ];

      // Play high notes (melody/plucks) on some beats to keep it interesting
      // A simple pentatonic melody that loops every 32 steps
      // Melodies are C, E, G, A
      const melodyNotes = [
        0, 0, 440, 0, 0, 523.25, 0, 0,
        0, 392, 0, 392, 0, 440, 0, 0,
        0, 0, 523.25, 0, 587.33, 0, 659.25, 0,
        0, 392, 0, 0, 440, 0, 0, 0
      ];

      // We'll schedule notes that fall within our lookahead window
      const timeOfNextStep = now + 0.05; // Schedule slightly in future

      // BASS synthesizer
      const bassFreq = bassRoots[this.currentStep % bassRoots.length];
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      const bassFilter = this.ctx.createBiquadFilter();

      bassOsc.type = "sawtooth";
      bassOsc.frequency.setValueAtTime(bassFreq, timeOfNextStep);
      
      bassFilter.type = "lowpass";
      bassFilter.frequency.setValueAtTime(140, timeOfNextStep);
      bassFilter.frequency.exponentialRampToValueAtTime(70, timeOfNextStep + stepDuration * 0.9);

      bassGain.gain.setValueAtTime(0, timeOfNextStep);
      // Nice thumping decay
      bassGain.gain.linearRampToValueAtTime(0.24, timeOfNextStep + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.001, timeOfNextStep + stepDuration * 0.95);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicVolNode);

      bassOsc.start(timeOfNextStep);
      bassOsc.stop(timeOfNextStep + stepDuration);

      // MELODY synth pluck (on selected steps)
      const melodyFreq = melodyNotes[this.currentStep % melodyNotes.length];
      if (melodyFreq > 0) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        const delay = this.ctx.createDelay();
        const feedback = this.ctx.createGain();

        leadOsc.type = "triangle";
        leadOsc.frequency.setValueAtTime(melodyFreq, timeOfNextStep);

        leadGain.gain.setValueAtTime(0, timeOfNextStep);
        leadGain.gain.linearRampToValueAtTime(0.05, timeOfNextStep + 0.01);
        leadGain.gain.exponentialRampToValueAtTime(0.001, timeOfNextStep + stepDuration * 1.5);

        // Simple delay loop for sci-fi atmosphere
        delay.delayTime.setValueAtTime(stepDuration * 0.75, timeOfNextStep);
        feedback.gain.setValueAtTime(0.3, timeOfNextStep);

        leadOsc.connect(leadGain);
        
        // Feed lead into delay line
        leadGain.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay); // loop back
        
        // Connect both direct and delayed signal to output
        leadGain.connect(this.musicVolNode);
        delay.connect(this.musicVolNode);

        leadOsc.start(timeOfNextStep);
        leadOsc.stop(timeOfNextStep + stepDuration * 2);
      }

      this.currentStep++;
    };

    // Keep scheduling notes in time intervals
    this.musicIntervalId = setInterval(scheduleNextBeats, stepDuration * 1000);
  }

  stopMusic() {
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    this.isMusicPlaying = false;
  }
}

export const sfx = new AudioEngine();
export default sfx;
