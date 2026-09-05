// Persistent Singleton Audio Manager
// Manages global audio playback with immutable cached snapshot for useSyncExternalStore

export interface AudioState {
  currentSrc: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isMuted: boolean;
}

export function normalizeAudioUrl(src: string): string {
  if (!src) return '';
  const s = src.trim();
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:') || s.startsWith('data:')) {
    return s;
  }
  if (s.startsWith('/audio/')) {
    return s;
  }
  if (s.startsWith('audio/')) {
    return `/${s}`;
  }
  if (s.startsWith('/')) {
    return `/audio${s}`;
  }
  return `/audio/${s}`;
}

class AudioManager {
  private audio: HTMLAudioElement;
  private currentSrc: string | null = null;
  private isPlaying: boolean = false;
  private currentTime: number = 0;
  private duration: number = 0;
  private playbackRate: number = 1.0;
  private isMuted: boolean = false;
  private listeners: Set<() => void> = new Set();
  private snapshot: AudioState;

  constructor() {
    this.subscribe = this.subscribe.bind(this);
    this.getState = this.getState.bind(this);
    this.togglePlay = this.togglePlay.bind(this);
    this.seek = this.seek.bind(this);
    this.toggleMute = this.toggleMute.bind(this);
    this.cycleSpeed = this.cycleSpeed.bind(this);
    this.restart = this.restart.bind(this);

    this.audio = typeof window !== 'undefined' ? new Audio() : ({} as HTMLAudioElement);
    this.audio.preload = 'metadata';
    this.snapshot = this.createSnapshot();

    if (typeof window !== 'undefined' && this.audio.addEventListener) {
      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('ended', () => {
        this.isPlaying = false;
        this.currentTime = 0;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('timeupdate', () => {
        this.currentTime = this.audio.currentTime;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('loadedmetadata', () => {
        this.duration = this.audio.duration || 0;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('durationchange', () => {
        this.duration = this.audio.duration || 0;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('ratechange', () => {
        this.playbackRate = this.audio.playbackRate;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('volumechange', () => {
        this.isMuted = this.audio.muted;
        this.updateSnapshotAndNotify();
      });

      this.audio.addEventListener('error', (e) => {
        console.warn('[AudioManager] Audio error:', e);
        this.isPlaying = false;
        this.updateSnapshotAndNotify();
      });
    }
  }

  private createSnapshot(): AudioState {
    return {
      currentSrc: this.currentSrc,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this.playbackRate,
      isMuted: this.isMuted,
    };
  }

  private updateSnapshotAndNotify() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('[AudioManager] Listener error:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Returns stable referential snapshot required by useSyncExternalStore
  public getState(): AudioState {
    return this.snapshot;
  }

  public togglePlay(rawSrc: string) {
    if (!rawSrc) return;
    const src = normalizeAudioUrl(rawSrc);

    if (this.currentSrc === src) {
      if (this.isPlaying) {
        this.audio.pause();
      } else {
        this.audio.play().catch(e => console.error('[AudioManager] play error:', e));
      }
    } else {
      this.currentSrc = src;
      this.audio.src = src;
      this.audio.playbackRate = this.playbackRate;
      this.audio.muted = this.isMuted;
      this.audio.currentTime = 0;
      this.currentTime = 0;
      this.duration = 0;
      this.updateSnapshotAndNotify();
      this.audio.play().catch(e => console.error('[AudioManager] play error:', e));
    }
  }

  public seek(seconds: number) {
    if (this.audio && !isNaN(seconds)) {
      this.audio.currentTime = seconds;
      this.currentTime = seconds;
      this.updateSnapshotAndNotify();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    this.updateSnapshotAndNotify();
  }

  public cycleSpeed(): number {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(this.playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    this.playbackRate = nextSpeed;
    this.audio.playbackRate = nextSpeed;
    this.updateSnapshotAndNotify();
    return nextSpeed;
  }

  public playUrl(rawSrc: string) {
    if (!rawSrc) return;
    const src = normalizeAudioUrl(rawSrc);
    this.currentSrc = src;
    this.audio.src = src;
    this.audio.playbackRate = this.playbackRate;
    this.audio.muted = this.isMuted;
    this.audio.currentTime = 0;
    this.currentTime = 0;
    this.duration = 0;
    this.updateSnapshotAndNotify();
    this.audio.play().catch(e => console.error('[AudioManager] playUrl error:', e));
  }

  public stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
      this.currentTime = 0;
      this.updateSnapshotAndNotify();
    }
  }

  public restart() {
    if (this.audio) {
      this.audio.currentTime = 0;
      this.currentTime = 0;
      this.audio.play().catch(() => {});
      this.updateSnapshotAndNotify();
    }
  }
}

export const globalAudio = new AudioManager();
