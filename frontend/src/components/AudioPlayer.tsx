import { useState, useEffect, useSyncExternalStore, memo } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Headphones, RotateCcw } from 'lucide-react';
import { globalAudio, normalizeAudioUrl } from '../lib/audioManager';

type AudioPlayerProps = {
  src: string;
  title?: string;
  autoPlay?: boolean;
};

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const subscribe = globalAudio.subscribe;
const getSnapshot = globalAudio.getState;

export const AudioPlayer = memo(function AudioPlayer({ src, title = 'Voice Recap / Audio' }: AudioPlayerProps) {
  const resolvedSrc = normalizeAudioUrl(src);

  // Subscribe to global singleton audio state with stable module-level references
  const audioState = useSyncExternalStore(subscribe, getSnapshot);

  const isCurrent = audioState.currentSrc === resolvedSrc;
  const isPlaying = isCurrent && audioState.isPlaying;
  const currentTime = isCurrent ? audioState.currentTime : 0;
  const duration = isCurrent ? audioState.duration : 0;
  const isMuted = audioState.isMuted;
  const playbackRate = audioState.playbackRate;

  // Local initial duration fallback before audio starts
  const [initialDuration, setInitialDuration] = useState(0);

  useEffect(() => {
    if (resolvedSrc) {
      const tempAudio = new Audio(resolvedSrc);
      tempAudio.preload = 'metadata';
      tempAudio.onloadedmetadata = () => {
        if (tempAudio.duration && !isNaN(tempAudio.duration)) {
          setInitialDuration(tempAudio.duration);
        }
      };
    }
  }, [resolvedSrc]);

  const displayDuration = duration > 0 ? duration : initialDuration;
  const progressPercent = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  const togglePlay = () => {
    globalAudio.togglePlay(resolvedSrc);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (isCurrent) {
      globalAudio.seek(target);
    } else {
      globalAudio.togglePlay(resolvedSrc);
      setTimeout(() => globalAudio.seek(target), 50);
    }
  };

  const toggleMute = () => {
    globalAudio.toggleMute();
  };

  const cycleSpeed = () => {
    globalAudio.cycleSpeed();
  };

  const restartAudio = () => {
    if (isCurrent) {
      globalAudio.restart();
    } else {
      globalAudio.togglePlay(resolvedSrc);
    }
  };

  const fileName = resolvedSrc.split('/').pop() || 'voice_recap.mp3';

  return (
    <div 
      className="custom-audio-player"
      style={{
        margin: '0.75rem 0',
        padding: '0.85rem 1rem',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.3), 0 2px 6px -1px rgba(0, 0, 0, 0.1)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        maxWidth: '520px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Bar: Title & Animated Equalizer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            padding: '0.25rem 0.45rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            flexShrink: 0
          }}>
            <Headphones size={13} />
            <span>VOICE RECAP</span>
          </div>

          <span 
            title={title !== 'Voice Recap / Audio' ? title : fileName}
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {title !== 'Voice Recap / Audio' ? title : fileName}
          </span>
        </div>

        {/* Animated Waveform / Equalizer Bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '14px', padding: '0 4px' }}>
          {[0.6, 1, 0.4, 0.8, 0.5, 0.9].map((h, i) => (
            <span
              key={i}
              style={{
                width: '3px',
                height: isPlaying ? `${Math.max(4, h * 14)}px` : '4px',
                background: isPlaying ? '#38bdf8' : '#64748b',
                borderRadius: '2px',
                transition: 'height 0.15s ease',
                animation: isPlaying ? `bounceWave 0.8s infinite ease-in-out ${i * 0.12}s alternate` : 'none'
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Controls Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
            transition: 'transform 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          title={isPlaying ? 'Pause' : 'Play Audio'}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: '2px' }} />}
        </button>

        {/* Timeline Track & Slider */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ position: 'relative', width: '100%', height: '18px', display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max={displayDuration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              style={{
                width: '100%',
                height: '5px',
                borderRadius: '3px',
                outline: 'none',
                background: `linear-gradient(to right, #38bdf8 ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                margin: 0
              }}
            />
          </div>

          {/* Time & Duration */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {/* Speed Toggle */}
          <button
            onClick={cycleSpeed}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#38bdf8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '0.25rem 0.4rem',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: '32px'
            }}
            title="Change Playback Speed"
          >
            {playbackRate}x
          </button>

          {/* Restart */}
          <button
            onClick={restartAudio}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '0.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Restart from beginning"
          >
            <RotateCcw size={14} />
          </button>

          {/* Mute Button */}
          <button
            onClick={toggleMute}
            style={{
              background: 'transparent',
              color: isMuted ? '#f87171' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '0.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Download Button */}
          <a
            href={resolvedSrc}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '0.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none'
            }}
            title="Download MP3"
          >
            <Download size={15} />
          </a>
        </div>
      </div>
    </div>
  );
});
