'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface CallLog {
  call_id: string;
  user_id: string;
  caller_name: string;
  status: 'successful' | 'failed' | 'in_progress';
  summary: string;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsData {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  in_progress_calls: number;
  success_rate: number;
  recent_calls: CallLog[];
}

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnalyticsDrawer({ isOpen, onClose }: AnalyticsDrawerProps) {
  const [data, setData] = useState<AnalyticsData>({
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    in_progress_calls: 0,
    success_rate: 0,
    recent_calls: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalytics = () => {
    setIsLoading(true);
    fetch('/api/analytics')
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setData({
            total_calls: resData.total_calls ?? 0,
            successful_calls: resData.successful_calls ?? 0,
            failed_calls: resData.failed_calls ?? 0,
            in_progress_calls: resData.in_progress_calls ?? 0,
            success_rate: resData.success_rate ?? 0,
            recent_calls: Array.isArray(resData.recent_calls) ? resData.recent_calls : [],
          });
        }
      })
      .catch((err) => console.error('Failed to fetch analytics:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  const formatTime = (isoString: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
          />

          {/* Modal / Drawer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[5%] bottom-[5%] z-50 mx-auto flex max-w-4xl flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#060c14]/95 shadow-[0_0_50px_rgba(0,212,255,0.2)] md:inset-x-auto md:w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 bg-[#081524] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-950/60 shadow-[0_0_15px_rgba(0,212,255,0.3)]">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-mono text-base font-bold tracking-wider text-cyan-300 uppercase">
                    Call Performance Dashboard
                  </h2>
                  <p className="font-mono text-xs text-cyan-400/60">
                    Track: Local Commerce (Product Discovery & Enquiry Resolution)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAnalytics}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 font-mono text-xs text-cyan-400 transition hover:border-cyan-400 hover:bg-cyan-900/60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-cyan-400/70 hover:bg-cyan-950 hover:text-cyan-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Top Summary Cards Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Total Calls */}
                <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-[#08192d]/80 p-4 shadow-[0_0_20px_rgba(0,212,255,0.08)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold uppercase text-cyan-400/80">
                      Total Calls
                    </span>
                    <PhoneCall className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-mono text-3xl font-extrabold text-white">
                      {data.total_calls}
                    </span>
                    <span className="font-mono text-[10px] text-cyan-400/60">Live Logged</span>
                  </div>
                </div>

                {/* Successful Calls */}
                <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold uppercase text-emerald-400/80">
                      Successful Calls
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-mono text-3xl font-extrabold text-emerald-300">
                      {data.successful_calls}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400/60">
                      Product/Enquiry Resolved
                    </span>
                  </div>
                </div>

                {/* Failed Calls */}
                <div className="relative overflow-hidden rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-[0_0_20px_rgba(244,63,94,0.08)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold uppercase text-rose-400/80">
                      Failed Calls
                    </span>
                    <XCircle className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-mono text-3xl font-extrabold text-rose-300">
                      {data.failed_calls}
                    </span>
                    <span className="font-mono text-[10px] text-rose-400/60">
                      Incomplete / Dropped
                    </span>
                  </div>
                </div>

                {/* Success Rate */}
                <div className="relative overflow-hidden rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 shadow-[0_0_20px_rgba(168,85,247,0.08)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold uppercase text-purple-400/80">
                      Success Rate
                    </span>
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-mono text-3xl font-extrabold text-purple-300">
                      {data.success_rate}%
                    </span>
                    <span className="font-mono text-[10px] text-purple-400/60">Target &gt; 80%</span>
                  </div>
                </div>
              </div>

              {/* Day 8 Definition Box */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-cyan-400" />
                  <h3 className="font-mono text-xs font-bold text-cyan-300 uppercase">
                    Local Commerce Success Definition
                  </h3>
                </div>
                <p className="font-mono text-xs text-cyan-400/70 leading-relaxed">
                  A call is recorded as <strong className="text-emerald-400">Successful</strong> when the caller finds a product, completes a restock enquiry, or gets an order status without dispute. A call is recorded as <strong className="text-rose-400">Failed</strong> if the call drops before completion, explicit opt-out occurs, or an unresolved dispute arises.
                </p>
              </div>

              {/* Recent Call Records List */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Recent Call Logs ({data.recent_calls.length})
                </h3>

                {data.recent_calls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cyan-500/20 py-12 text-center">
                    <PhoneCall className="h-8 w-8 text-cyan-500/40" />
                    <p className="mt-3 font-mono text-xs text-cyan-400/60">
                      No call records logged yet. Start a call with Pooja to generate real telemetry data!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.recent_calls.map((call) => (
                      <div
                        key={call.call_id}
                        className="flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-[#071322] p-4 transition hover:border-cyan-500/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-cyan-300">
                              {call.call_id}
                            </span>
                            {call.status === 'successful' ? (
                              <span className="flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                                <CheckCircle2 className="h-3 w-3" /> Successful
                              </span>
                            ) : call.status === 'failed' ? (
                              <span className="flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-950/70 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 uppercase">
                                <XCircle className="h-3 w-3" /> Failed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-950/70 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase">
                                <Clock className="h-3 w-3" /> In Progress
                              </span>
                            )}
                          </div>

                          <p className="font-mono text-xs text-cyan-100/90">
                            {call.summary || 'Product enquiry call processed.'}
                          </p>

                          <div className="flex items-center gap-3 font-mono text-[11px] text-cyan-400/60">
                            <span>User: {call.user_id}</span>
                            <span>•</span>
                            <span>Time: {formatTime(call.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
