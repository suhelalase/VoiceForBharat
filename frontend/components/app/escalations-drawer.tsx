'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface Escalation {
  escalation_id: string;
  user_id: string;
  caller_name: string;
  category: string;
  summary_what_happened: string;
  summary_agent_checked: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  language: string;
  followup_method: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
}

interface EscalationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EscalationsDrawer({ isOpen, onClose }: EscalationsDrawerProps) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchEscalations = () => {
    setIsLoading(true);
    fetch('/api/escalations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.escalations)) {
          setEscalations(data.escalations);
        }
      })
      .catch((err) => console.error('Failed to fetch escalations:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchEscalations();
    }
  }, [isOpen]);

  const handleResolve = async (esc: Escalation) => {
    try {
      setResolvingId(esc.escalation_id);
      const res = await fetch('/api/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          escalation_id: esc.escalation_id,
          destination: esc.user_id,
          caller_name: esc.caller_name || 'Customer',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchEscalations();
      }
    } catch (err) {
      console.error('Failed to resolve escalation:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'emergency':
        return (
          <span className="flex items-center gap-1 rounded-full border border-red-500/50 bg-red-950/70 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
            <ShieldAlert className="h-3 w-3" /> Emergency
          </span>
        );
      case 'high':
        return (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-950/70 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
            <AlertTriangle className="h-3 w-3" /> High
          </span>
        );
      case 'medium':
        return (
          <span className="flex items-center gap-1 rounded-full border border-cyan-500/50 bg-cyan-950/70 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
            Medium
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-full border border-slate-500/50 bg-slate-900/70 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
            <Clock className="h-3.5 w-3.5 animate-spin" /> In Progress
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-400">
            <Clock className="h-3.5 w-3.5" /> Open
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[#00d4ff]/30 bg-[#050b14] text-slate-200 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#00d4ff]/20 bg-[#081222] px-6 py-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-[#00d4ff]" />
                <div>
                  <h2 className="font-mono text-sm font-bold tracking-wider text-[#00d4ff] uppercase">
                    Human Escalation Requests
                  </h2>
                  <p className="font-mono text-[10px] text-slate-400">
                    Local Commerce · Disputes & Escalated Calls
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchEscalations}
                  className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-400"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {isLoading && escalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 font-mono text-xs text-slate-500">
                  <RefreshCw className="mb-2 h-6 w-6 animate-spin text-[#00d4ff]" />
                  Fetching escalation records...
                </div>
              ) : escalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 font-mono text-xs text-slate-500">
                  <UserCheck className="mb-3 h-10 w-10 text-emerald-500/50" />
                  No open escalation requests found.
                </div>
              ) : (
                escalations.map((esc) => (
                  <div
                    key={esc.escalation_id}
                    className="space-y-3 rounded-xl border border-slate-800 bg-[#081324] p-4 shadow-lg transition hover:border-[#00d4ff]/40"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#00d4ff]">
                          {esc.escalation_id}
                        </span>
                        {getUrgencyBadge(esc.urgency)}
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300 capitalize">
                          {esc.category.replace('_', ' ')}
                        </span>
                      </div>
                      {getStatusBadge(esc.status)}
                    </div>

                    <div className="space-y-1.5 font-mono text-xs">
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase">
                          Caller / Contact:
                        </span>
                        <span className="text-slate-200">
                          {esc.caller_name || 'Anonymous Caller'} ({esc.user_id})
                        </span>
                      </div>

                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase">
                          What Happened (Redacted):
                        </span>
                        <p className="rounded border border-slate-800/50 bg-slate-950/60 p-2 text-[11px] leading-relaxed text-slate-300">
                          {esc.summary_what_happened || 'No details provided.'}
                        </p>
                      </div>

                      {esc.summary_agent_checked && (
                        <div>
                          <span className="block text-[10px] text-slate-500 uppercase">
                            Agent Verification:
                          </span>
                          <p className="text-[11px] text-slate-400 italic">
                            {esc.summary_agent_checked}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-slate-400">
                        <span>
                          Language: <strong className="text-slate-300">{esc.language}</strong>
                        </span>
                        <span>
                          Follow-up:{' '}
                          <strong className="text-slate-300">{esc.followup_method}</strong>
                        </span>
                        <span>Created: {new Date(esc.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {esc.status !== 'resolved' && (
                      <div className="flex justify-end border-t border-slate-800/80 pt-2">
                        <button
                          onClick={() => handleResolve(esc)}
                          disabled={resolvingId === esc.escalation_id}
                          className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/60 px-4 py-2 font-mono text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          {resolvingId === esc.escalation_id
                            ? 'Resolving & Calling...'
                            : 'Resolve & Call Customer'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
