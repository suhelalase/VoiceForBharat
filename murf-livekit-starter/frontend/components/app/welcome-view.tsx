import { Button } from '@/components/ui/button';
import { Sparkles, Mic, Zap, Cpu, ArrowRight } from 'lucide-react';

function BharatChakraEmblem() {
  return (
    <div className="relative mb-8 flex items-center justify-center">
      {/* Outer Glowing Cyber Ring */}
      <div className="absolute size-40 animate-pulse rounded-full bg-gradient-to-tr from-amber-500/20 via-orange-500/5 to-cyan-500/20 blur-2xl" />
      
      {/* Center Glass Capsule with Glowing Border */}
      <div className="relative flex size-32 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 shadow-[0_0_30px_rgba(0,229,255,0.1)] backdrop-blur-2xl">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-20 text-cyan-400 chakra-icon animate-[spin_60s_linear_infinite]"
        >
          {/* Outer Chakra Rim */}
          <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="38" stroke="url(#saffron_cyan)" strokeWidth="2" />
          <circle cx="50" cy="50" r="14" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="4" fill="#00E5FF" />
          
          {/* 24 Spokes of Ashoka Chakra */}
          {[...Array(24)].map((_, i) => (
            <line
              key={i}
              x1="50"
              y1="50"
              x2={(50 + 36 * Math.cos((i * 15 * Math.PI) / 180)).toFixed(4)}
              y2={(50 + 36 * Math.sin((i * 15 * Math.PI) / 180)).toFixed(4)}
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          ))}

          <defs>
            <linearGradient id="saffron_cyan" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF9933" />
              <stop offset="0.5" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#00E5FF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
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
    <div ref={ref} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070913] px-4 py-16 text-white selection:bg-cyan-500/30">
      
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 rounded-full bg-orange-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />
      
      {/* Decorative top pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] -z-10 pointer-events-none opacity-40" />

      <section className="relative z-10 flex max-w-xl flex-col items-center text-center">
        {/* Main Glassmorphism Card */}
        <div className="relative rounded-3xl border border-white/10 bg-slate-950/40 p-8 shadow-[0_0_50px_rgba(255,153,51,0.05)] backdrop-blur-xl md:p-12">
          
          {/* Top Tag Pill */}
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-amber-500/20 bg-amber-950/30 px-4 py-1.5 text-xs font-semibold tracking-widest text-amber-400 uppercase">
            <span>🇮🇳</span>
            <span>BHARAT VOICE ENGINE LIVE</span>
          </div>

          <BharatChakraEmblem />

          <h1 className="mb-2 text-4xl font-black tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-orange-400 via-white to-cyan-400 bg-clip-text text-transparent">
              ZeroxAI
            </span>
          </h1>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
            AIBHARAT EDITION • Gemini 3.5 &amp; Murf Falcon
          </p>

          <p className="mx-auto max-w-sm text-sm text-slate-300 font-medium leading-relaxed">
            Experience ultra-fast, conversational voice AI tailored for India. 
            Talk naturally in English with authentic Indian phrasing.
          </p>

          {/* Feature Grid / Box UI */}
          <div className="my-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-900/50 p-4 transition-all duration-300 hover:border-orange-500/30 hover:bg-slate-900/80">
              <Mic className="mb-2 size-5 text-orange-400" />
              <span className="text-[11px] font-bold text-slate-400">VOICE</span>
              <span className="mt-1 text-xs font-semibold text-slate-200">Murf Anisha</span>
            </div>
            
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-900/50 p-4 transition-all duration-300 hover:border-white/20 hover:bg-slate-900/80">
              <Zap className="mb-2 size-5 text-yellow-400" />
              <span className="text-[11px] font-bold text-slate-400">LATENCY</span>
              <span className="mt-1 text-xs font-semibold text-slate-200">~300ms Ultra-Low</span>
            </div>
            
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-900/50 p-4 transition-all duration-300 hover:border-cyan-500/30 hover:bg-slate-900/80">
              <Cpu className="mb-2 size-5 text-cyan-400" />
              <span className="text-[11px] font-bold text-slate-400">MODEL</span>
              <span className="mt-1 text-xs font-semibold text-slate-200">Gemini 3.5 Flash</span>
            </div>
          </div>

          {/* Start Button */}
          <Button
            size="lg"
            onClick={onStartCall}
            className="group relative h-14 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-cyan-500 font-mono text-sm font-bold tracking-wider text-slate-950 uppercase shadow-lg shadow-orange-500/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-orange-500/25 active:scale-95"
          >
            <span className="relative z-10 flex items-center justify-center space-x-2">
              <span>{startButtonText}</span>
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-white to-orange-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <div className="mt-12 text-center text-xs text-slate-500">
        <p className="tracking-wider">
          Powered by{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://murf.ai"
            className="text-orange-400 underline underline-offset-4 hover:text-orange-300"
          >
            Murf Falcon TTS
          </a>{' '}
          &amp;{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://livekit.io"
            className="text-cyan-400 underline underline-offset-4 hover:text-cyan-300"
          >
            LiveKit Agents
          </a>
        </p>
      </div>
    </div>
  );
};
