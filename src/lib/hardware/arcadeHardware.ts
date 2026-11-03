"use client";

import type { ThermalState } from "@/types/radar";

// ============================================================================
// RADAR QUEST - 8-Bit Chiptune Web Audio Synth, Haptics & Screen Wake Lock
// ============================================================================

class ArcadeHardwareController {
  private audioCtx: AudioContext | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private muted = false;
  private bgmAudio: HTMLAudioElement | null = null;

  private ensureAudio(): AudioContext | null {
    if (typeof window === "undefined" || this.muted) return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public playBgm(src = "/audio/bgm.mp3", volume = 0.35) {
    if (typeof window === "undefined") return;
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(src);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = volume;
    }
    if (this.muted) return;
    this.bgmAudio.play().catch(() => {
      // El navegador puede requerir interacción previa del usuario
    });
  }

  public pauseBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.pauseBgm();
    } else {
      this.playBgm();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Plays an 8-bit square/triangle tone sequence.
   */
  private playNotes(
    notes: Array<{
      freq: number;
      duration: number;
      type?: OscillatorType;
      gain?: number;
    }>
  ) {
    const ctx = this.ensureAudio();
    if (!ctx) return;

    let offset = ctx.currentTime;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();

      osc.type = note.type || "square";
      osc.frequency.setValueAtTime(note.freq, offset);

      const peak = note.gain ?? 0.06;
      amp.gain.setValueAtTime(peak, offset);
      amp.gain.exponentialRampToValueAtTime(0.001, offset + note.duration);

      osc.connect(amp);
      amp.connect(ctx.destination);

      osc.start(offset);
      osc.stop(offset + note.duration);
      offset += note.duration * 0.92;
    }
  }

  /**
   * Triggers thermal radar sonar audio + native vibration pattern.
   */
  public triggerThermalFeedback(state: ThermalState) {
    switch (state) {
      case "FUERA DE ZONA":
        this.playNotes([{ freq: 165, duration: 0.14, type: "triangle", gain: 0.04 }]);
        break;
      case "CONGELADO":
        this.playNotes([
          { freq: 262, duration: 0.09, type: "square", gain: 0.04 },
        ]);
        this.vibrate([30]);
        break;
      case "TIBIO":
        this.playNotes([
          { freq: 392, duration: 0.08, type: "square", gain: 0.05 },
          { freq: 440, duration: 0.08, type: "square", gain: 0.05 },
        ]);
        this.vibrate([45, 60, 45]);
        break;
      case "CALIENTE":
        this.playNotes([
          { freq: 523.25, duration: 0.07, type: "square", gain: 0.06 },
          { freq: 659.25, duration: 0.07, type: "square", gain: 0.06 },
          { freq: 783.99, duration: 0.09, type: "square", gain: 0.06 },
        ]);
        this.vibrate([70, 45, 90]);
        break;
      case "QUEMANDO":
        this.playNotes([
          { freq: 784, duration: 0.06, type: "square", gain: 0.08 },
          { freq: 988, duration: 0.06, type: "square", gain: 0.08 },
          { freq: 1175, duration: 0.07, type: "square", gain: 0.08 },
          { freq: 1568, duration: 0.12, type: "square", gain: 0.09 },
        ]);
        this.vibrate([120, 40, 120, 40, 180]);
        break;
      case "TELEPORT_ANOMALY":
        this.playNotes([
          { freq: 220, duration: 0.12, type: "sawtooth", gain: 0.08 },
          { freq: 130, duration: 0.22, type: "sawtooth", gain: 0.08 },
        ]);
        this.vibrate([220, 80, 220]);
        break;
    }
  }

  public playRivalDangerSiren() {
    this.playNotes([
      { freq: 880, duration: 0.09, type: "sawtooth", gain: 0.07 },
      { freq: 587, duration: 0.09, type: "sawtooth", gain: 0.07 },
      { freq: 880, duration: 0.09, type: "sawtooth", gain: 0.07 },
    ]);
    this.vibrate([150, 50, 150, 50, 150]);
  }

  public playPowerUpOnboarding() {
    this.playNotes([
      { freq: 330, duration: 0.07, type: "square", gain: 0.06 },
      { freq: 440, duration: 0.07, type: "square", gain: 0.06 },
      { freq: 554, duration: 0.07, type: "square", gain: 0.06 },
      { freq: 659, duration: 0.14, type: "square", gain: 0.07 },
    ]);
    this.vibrate([50, 30, 80]);
  }

  public playVictoryFanfare() {
    this.playNotes([
      { freq: 523.25, duration: 0.09, type: "square", gain: 0.08 },
      { freq: 659.25, duration: 0.09, type: "square", gain: 0.08 },
      { freq: 783.99, duration: 0.09, type: "square", gain: 0.08 },
      { freq: 1046.5, duration: 0.26, type: "square", gain: 0.09 },
    ]);
    this.vibrate([100, 40, 100, 40, 300]);
  }

  public vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore unsupported browser context
      }
    }
  }

  /**
   * Requests Screen Wake Lock so the phone display stays awake while walking.
   */
  public async requestWakeLock(): Promise<boolean> {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }
    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
        return true;
      }
      this.wakeLockSentinel = await navigator.wakeLock.request("screen");
      return true;
    } catch {
      return false;
    }
  }

  public async releaseWakeLock() {
    try {
      if (this.wakeLockSentinel) {
        await this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      }
    } catch {
      // Ignore
    }
  }
}

export const arcadeHardware = new ArcadeHardwareController();

