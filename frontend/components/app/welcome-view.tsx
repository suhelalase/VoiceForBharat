'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

// Animated rotating ring SVG
function JarvisRings() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      {/* Outermost glow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          border: '1px solid rgba(0,212,255,0.12)',
          boxShadow: '0 0 30px rgba(0,212,255,0.08)',
          animation: 'zerox-spin-slow 20s linear infinite',
        }}
      />

      {/* Outer ring with dashes */}
      <svg
        width="280"
        height="280"
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute"
        style={{ animation: 'zerox-spin-slow 15s linear infinite' }}
      >
        <circle
          cx="140"
          cy="140"
          r="135"
          stroke="rgba(0,212,255,0.25)"
          strokeWidth="1"
          strokeDasharray="8 6"
        />
        {/* Tick marks */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i * 10 * Math.PI) / 180;
          const x1 = 140 + 130 * Math.cos(angle);
          const y1 = 140 + 130 * Math.sin(angle);
          const x2 = 140 + (i % 3 === 0 ? 120 : 124) * Math.cos(angle);
          const y2 = 140 + (i % 3 === 0 ? 120 : 124) * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i % 3 === 0 ? 'rgba(0,212,255,0.6)' : 'rgba(0,212,255,0.2)'}
              strokeWidth={i % 3 === 0 ? '1.5' : '1'}
            />
          );
        })}
      </svg>

      {/* Middle ring counter-rotating */}
      <svg
        width="220"
        height="220"
        viewBox="0 0 220 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute"
        style={{ animation: 'zerox-spin-reverse 8s linear infinite' }}
      >
        <circle
          cx="110"
          cy="110"
          r="105"
          stroke="rgba(0,212,255,0.35)"
          strokeWidth="1.5"
          strokeDasharray="20 8 5 8"
          strokeLinecap="round"
        />
        {/* Glowing arc segment */}
        <path
          d="M 110 5 A 105 105 0 0 1 205 110"
          stroke="rgba(0,212,255,0.9)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Inner ring */}
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute"
        style={{ animation: 'zerox-spin-slow 10s linear infinite' }}
      >
        <circle
          cx="80"
          cy="80"
          r="75"
          stroke="rgba(0,212,255,0.2)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {/* 4 corner diamonds */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 80 + 75 * Math.cos(rad);
          const y = 80 + 75 * Math.sin(rad);
          return (
            <polygon
              key={deg}
              points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`}
              fill="rgba(0,212,255,0.7)"
              stroke="rgba(0,212,255,0.4)"
              strokeWidth="0.5"
            />
          );
        })}
      </svg>

      {/* Core hexagon */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 90,
          height: 90,
          animation: 'zerox-pulse-ring 3s ease-in-out infinite',
        }}
      >
        <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
          <polygon
            points="45,5 80,22.5 80,67.5 45,85 10,67.5 10,22.5"
            stroke="rgba(0,212,255,0.7)"
            strokeWidth="1.5"
            fill="rgba(0,212,255,0.08)"
          />
          <polygon
            points="45,15 70,28.5 70,61.5 45,75 20,61.5 20,28.5"
            stroke="rgba(0,212,255,0.35)"
            strokeWidth="1"
            fill="rgba(0,212,255,0.05)"
          />
          {/* Center pulsing dot */}
          <circle
            cx="45"
            cy="45"
            r="8"
            fill="rgba(0,212,255,0.15)"
            stroke="#00d4ff"
            strokeWidth="1.5"
          />
          <circle cx="45" cy="45" r="4" fill="#00d4ff" opacity="0.9" />
          {/* Cross lines */}
          <line x1="45" y1="37" x2="45" y2="53" stroke="rgba(0,212,255,0.4)" strokeWidth="0.5" />
          <line x1="37" y1="45" x2="53" y2="45" stroke="rgba(0,212,255,0.4)" strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  );
}

// HUD data panels on sides
function HUDPanel({ side }: { side: 'left' | 'right' }) {
  const lines =
    side === 'left'
      ? [
          { label: 'NEURAL CORE', value: 'ACTIVE' },
          { label: 'STT ENGINE', value: 'DEEPGRAM' },
          { label: 'TTS ENGINE', value: 'MURF FALCON' },
          { label: 'LLM', value: 'GEMINI' },
          { label: 'MEMORY', value: 'SQLITE' },
        ]
      : [
          { label: 'RECALL', value: 'ACTIVE' },
          { label: 'PROTOCOL', value: 'LIVEKIT' },
          { label: 'ENCRYPTION', value: 'E2E AES' },
          { label: 'CONSENT', value: 'REQUIRED' },
          { label: 'MODE', value: 'REALTIME' },
        ];

  return (
    <div
      className="flex flex-col gap-2 opacity-60"
      style={{
        fontFamily: 'var(--font-commit-mono), monospace',
        textAlign: side === 'left' ? 'right' : 'left',
      }}
    >
      {lines.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <span style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em' }}>
            {item.label}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#00d4ff',
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Scanning horizontal bar
function ScanLine() {
  return (
    <div
      className="pointer-events-none absolute right-0 left-0"
      style={{
        height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
        animation: 'zerox-scan-line 4s linear infinite',
        top: 0,
      }}
    />
  );
}

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref} className="relative">
      {/* Scan line effect on full screen */}
      <ScanLine />

      <section
        className="relative flex flex-col items-center justify-center text-center"
        style={{ minHeight: '100vh' }}
      >
        {/* Background radial glow */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Main content area */}
        <div className="relative flex flex-col items-center gap-8 px-4">
          {/* Top label */}
          <div
            className="flex items-center gap-3"
            style={{
              fontFamily: 'var(--font-commit-mono), monospace',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: 'rgba(0,212,255,0.6)',
              textTransform: 'uppercase',
            }}
          >
            <span className="zerox-status-dot" />
            <span>Neural Interface Ready</span>
            <span className="zerox-status-dot" />
          </div>

          {/* Jarvis rings + side panels */}
          <div className="flex items-center gap-12">
            {/* Left HUD panel */}
            <div className="hidden md:block">
              <HUDPanel side="left" />
            </div>

            {/* Central rings */}
            <JarvisRings />

            {/* Right HUD panel */}
            <div className="hidden md:block">
              <HUDPanel side="right" />
            </div>
          </div>

          {/* ZeroxAI title */}
          <div className="flex flex-col items-center gap-2">
            <h1
              className="font-mono font-bold tracking-[0.3em] uppercase"
              style={{
                fontSize: '2.5rem',
                color: '#00d4ff',
                textShadow:
                  '0 0 20px rgba(0,212,255,0.8), 0 0 40px rgba(0,212,255,0.4), 0 0 80px rgba(0,212,255,0.2)',
                animation: 'zerox-flicker 8s ease-in-out infinite',
              }}
            >
              ZeroxAI
            </h1>
            <p
              className="font-mono tracking-[0.2em] uppercase"
              style={{ fontSize: '0.7rem', color: 'rgba(0,212,255,0.5)' }}
            >
              Voice Intelligence · Persistent Memory
            </p>
          </div>

          {/* Divider line */}
          <div
            className="w-full"
            style={{
              maxWidth: 320,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
            }}
          />

          {/* Description */}
          <p
            className="font-mono"
            style={{
              maxWidth: 380,
              fontSize: '0.75rem',
              color: 'rgba(0,212,255,0.5)',
              lineHeight: 1.8,
              letterSpacing: '0.05em',
            }}
          >
            Activate the neural voice interface to begin real-time AI communication. Powered by Murf
            Falcon TTS and LiveKit Agents.
          </p>

          {/* Initialize button */}
          <div className="relative">
            {/* Button glow */}
            <div
              className="pointer-events-none absolute"
              style={{
                inset: -20,
                borderRadius: 50,
                background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
                animation: 'zerox-pulse-ring 3s ease-in-out infinite',
              }}
            />
            <Button
              size="lg"
              onClick={onStartCall}
              className="relative mt-2 w-72 rounded-full font-mono text-xs font-bold tracking-wider uppercase"
            >
              {startButtonText}
            </Button>
          </div>

          {/* Bottom HUD indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {['VOICE READY', 'AI CONNECTED', 'ENCRYPTED', 'MEMORY ACTIVE'].map((label, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: label === 'MEMORY ACTIVE' ? '#a78bfa' : '#00d4ff',
                    boxShadow: label === 'MEMORY ACTIVE' ? '0 0 6px #a78bfa' : '0 0 4px #00d4ff',
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-commit-mono), monospace',
                    fontSize: '9px',
                    color:
                      label === 'MEMORY ACTIVE' ? 'rgba(167,139,250,0.7)' : 'rgba(0,212,255,0.5)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
