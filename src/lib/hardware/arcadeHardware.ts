"use client";

import type { ThermalState } from "@/types/radar";

// ============================================================================
// RADAR QUEST - 8-Bit Chiptune Web Audio Synth, Adaptive BGM, Haptics & WakeLock
// ============================================================================

type BgmTrackKey = "exploration" | "tension" | "climax";

const BGM_TRACK_KEYS: BgmTrackKey[] = ["exploration", "tension", "climax"];

const BGM_TRACK_SOURCES: Record<BgmTrackKey, string> = {
  exploration: "/audio/bgm.mp3",
  tension: "/audio/bgm_tension.mp3",
  climax: "/audio/bgm_climax.mp3",
};

const BGM_DEFAULT_VOLUMES: Record<BgmTrackKey, number> = {
  exploration: 0.35,
  tension: 0.38,
  climax: 0.45,
};

class ArcadeHardwareController {
  private audioCtx: AudioContext | null = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private muted = false;
  private bgmTracks: Partial<Record<BgmTrackKey, HTMLAudioElement>> = {};
  private unlockedTracks = new Set<BgmTrackKey>();
  private activeTrack: BgmTrackKey = "exploration";
  private desiredTrack: BgmTrackKey = "exploration";
  private desiredVolume = 0.35;
  private bgmStarted = false;
  private crossfadeTimer: number | null = null;

  private resolveBgmConfig(state: ThermalState): {
    track: BgmTrackKey;
    volume: number;
  } {
    switch (state) {
      case "QUEMANDO":
        return { track: "climax", volume: 0.45 };
      case "CALIENTE":
        return { track: "tension", volume: 0.42 };
      case "TIBIO":
        return { track: "tension", volume: 0.38 };
      case "FUERA DE ZONA":
      case "CONGELADO":
      case "TELEPORT_ANOMALY":
      default:
        return { track: "exploration", volume: 0.35 };
    }
  }

  private safeSetVolume(audio: HTMLAudioElement, volume: number): boolean {
    const clamped = Math.max(0, Math.min(1, volume));
    try {
      audio.volume = clamped;
      return Math.abs(audio.volume - clamped) < 0.25;
    } catch {
      return false;
    }
  }

  private getOrCreateTrack(key: BgmTrackKey): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.bgmTracks[key]) {
      const audio = new Audio();
      audio.src = BGM_TRACK_SOURCES[key];
      audio.preload = "auto";
      audio.loop = true;
      this.safeSetVolume(audio, BGM_DEFAULT_VOLUMES[key]);
      this.bgmTracks[key] = audio;
    }
    return this.bgmTracks[key]!;
  }

  private clearCrossfade() {
    if (this.crossfadeTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
  }

  /**
   * Unlocks inactive <audio> elements silently inside a user gesture so mobile
   * browsers (iOS Safari / Android Chrome) allow async GPS-triggered transitions.
   */
  private unlockInactiveTracksFromGesture(excludeKey: BgmTrackKey) {
    for (const key of BGM_TRACK_KEYS) {
      if (key === excludeKey || this.unlockedTracks.has(key)) continue;
      const audio = this.getOrCreateTrack(key);
      if (!audio) continue;

      audio.muted = true;
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => {
          this.unlockedTracks.add(key);
          if (this.desiredTrack !== key || this.muted || !this.bgmStarted) {
            audio.pause();
            audio.currentTime = 0;
          }
          audio.muted = false;
        }).catch(() => {
          audio.muted = false;
        });
      } else {
        audio.muted = false;
      }
    }
  }

  public preloadBgm(_src = "/audio/bgm.mp3", _volume = 0.35) {
    if (typeof window === "undefined") return;
    for (const key of BGM_TRACK_KEYS) {
      this.getOrCreateTrack(key)?.load();
    }
  }

  public initAudioContext(): AudioContext | null {
    return this.ensureAudio();
  }

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
      this.audioCtx.resume().catch(() => { });
    }
    return this.audioCtx;
  }

  public playBgm(_src?: string, _volume?: number) {
    if (typeof window === "undefined") return;
    this.bgmStarted = true;
    if (this.muted) return;

    this.clearCrossfade();
    const targetKey = this.desiredTrack;

    for (const key of BGM_TRACK_KEYS) {
      if (key === targetKey) continue;
      const otherAudio = this.bgmTracks[key];
      if (otherAudio && !otherAudio.paused) {
        otherAudio.pause();
      }
    }

    this.unlockInactiveTracksFromGesture(targetKey);

    const targetAudio = this.getOrCreateTrack(targetKey);
    if (!targetAudio) return;

    targetAudio.muted = false;
    this.safeSetVolume(targetAudio, this.desiredVolume);
    this.activeTrack = targetKey;
    targetAudio
      .play()
      .then(() => {
        this.unlockedTracks.add(targetKey);
      })
      .catch(() => {
        // El navegador puede requerir interacción previa del usuario
      });
  }

  /**
   * Dynamically crossfades across 3 adaptive BGM stems:
   * - Exploration (/audio/bgm.mp3, 100 BPM): FUERA DE ZONA / CONGELADO
   * - Tension (/audio/bgm_tension.mp3, 110 BPM): TIBIO / CALIENTE
   * - Climax (/audio/bgm_climax.mp3, 120 BPM): ¡QUEMANDO! (<30m on foot)
   */
  public syncBgmWithThermalState(state: ThermalState) {
    if (typeof window === "undefined") return;
    const { track: nextTrack, volume: nextVolume } =
      this.resolveBgmConfig(state);
    this.desiredTrack = nextTrack;
    this.desiredVolume = nextVolume;

    if (this.muted || !this.bgmStarted) return;

    if (nextTrack === this.activeTrack) {
      if (this.crossfadeTimer === null) {
        const currentAudio = this.getOrCreateTrack(nextTrack);
        if (currentAudio) {
          this.safeSetVolume(currentAudio, nextVolume);
          if (currentAudio.paused) {
            currentAudio.play().catch(() => { });
          }
        }
      }
      return;
    }

    this.clearCrossfade();
    const prevTrack = this.activeTrack;
    this.activeTrack = nextTrack;

    // Ensure any third track from an interrupted earlier fade is paused cleanly
    for (const key of BGM_TRACK_KEYS) {
      if (key !== prevTrack && key !== nextTrack) {
        const extra = this.bgmTracks[key];
        if (extra && !extra.paused) {
          extra.pause();
        }
      }
    }

    const outgoing = this.getOrCreateTrack(prevTrack);
    const incoming = this.getOrCreateTrack(nextTrack);
    if (!incoming) return;

    incoming.muted = false;
    // Start Climax from beat 1 so the triumphant 120 BPM synth brass hits right at <30m
    if (nextTrack === "climax") {
      try {
        incoming.currentTime = 0;
      } catch {
        // Ignore if metadata not yet seekable
      }
    }

    const canFade = this.safeSetVolume(incoming, 0.01);

    if (!canFade || !outgoing || outgoing.paused) {
      if (outgoing && !outgoing.paused) {
        outgoing.pause();
      }
      this.safeSetVolume(incoming, nextVolume);
      incoming.play().catch(() => { });
      return;
    }

    const startOutVol = outgoing.volume || BGM_DEFAULT_VOLUMES[prevTrack];
    incoming.play().catch(() => { });

    let step = 0;
    const totalSteps = nextTrack === "climax" ? 12 : 18;
    this.crossfadeTimer = window.setInterval(() => {
      if (this.muted || !this.bgmStarted) {
        this.clearCrossfade();
        outgoing.pause();
        incoming.pause();
        return;
      }

      step += 1;
      const t = Math.min(1, step / totalSteps);
      this.safeSetVolume(outgoing, startOutVol * (1 - t));
      this.safeSetVolume(incoming, this.desiredVolume * t);

      if (step >= totalSteps) {
        this.clearCrossfade();
        outgoing.pause();
        this.safeSetVolume(outgoing, BGM_DEFAULT_VOLUMES[prevTrack]);
        this.safeSetVolume(incoming, this.desiredVolume);
      }
    }, 45);
  }

  public pauseBgm() {
    this.clearCrossfade();
    for (const key of BGM_TRACK_KEYS) {
      const audio = this.bgmTracks[key];
      if (audio && !audio.paused) {
        audio.pause();
      }
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.pauseBgm();
    } else if (this.bgmStarted) {
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
   * Triggers thermal radar sonar audio feedback (vibration disabled on routine pings to conserve battery).
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
        break;
      case "TIBIO":
        this.playNotes([
          { freq: 392, duration: 0.08, type: "square", gain: 0.05 },
          { freq: 440, duration: 0.08, type: "square", gain: 0.05 },
        ]);
        break;
      case "CALIENTE":
        this.playNotes([
          { freq: 523.25, duration: 0.07, type: "square", gain: 0.06 },
          { freq: 659.25, duration: 0.07, type: "square", gain: 0.06 },
          { freq: 783.99, duration: 0.09, type: "square", gain: 0.06 },
        ]);
        break;
      case "QUEMANDO":
        this.playNotes([
          { freq: 784, duration: 0.06, type: "square", gain: 0.08 },
          { freq: 988, duration: 0.06, type: "square", gain: 0.08 },
          { freq: 1175, duration: 0.07, type: "square", gain: 0.08 },
          { freq: 1568, duration: 0.12, type: "square", gain: 0.09 },
        ]);
        break;
      case "TELEPORT_ANOMALY":
        this.playNotes([
          { freq: 220, duration: 0.12, type: "sawtooth", gain: 0.08 },
          { freq: 130, duration: 0.22, type: "sawtooth", gain: 0.08 },
        ]);
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

  /**
   * Plays the 16-bit retro freeze sound effect (icy wind whoosh + ice crack shimmer)
   */
  public playFreezeSound() {
    if (typeof window === "undefined" || this.muted) return;
    try {
      const audio = new Audio("/audio/sfx_freeze.mp3");
      audio.volume = 0.2;
      audio.play().catch(() => { });
      this.vibrate([40, 30, 60]);
    } catch {
      // Fallback
    }
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

