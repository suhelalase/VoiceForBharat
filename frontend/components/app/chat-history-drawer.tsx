'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarIcon,
  ClockIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react/dist/ssr';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatSessionItem {
  session_id: string;
  user_id?: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
}

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOCAL_STORAGE_KEY = 'voice_for_bharat_chat_history';

export function getLocalChatHistory(): ChatSessionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatHistory(sessions: ChatSessionItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save chat history to localStorage', e);
  }
}

export function ChatHistoryDrawer({ isOpen, onClose }: ChatHistoryDrawerProps) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial local history immediately
    const local = getLocalChatHistory();
    setSessions(local);
    if (local.length > 0 && !selectedSessionId) {
      setSelectedSessionId(local[0].session_id);
    }

    // Fetch synced history from API
    setIsLoading(true);
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0) {
          setSessions(data.sessions);
          saveLocalChatHistory(data.sessions);
          if (!selectedSessionId) {
            setSelectedSessionId(data.sessions[0].session_id);
          }
        }
      })
      .catch((err) => console.warn('Could not fetch server history:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchMsg = s.messages.some((m) => m.content.toLowerCase().includes(q));
      return matchTitle || matchMsg;
    });
  }, [sessions, searchQuery]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.session_id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all previous chat history?')) return;
    setSessions([]);
    setSelectedSessionId(null);
    saveLocalChatHistory([]);
    try {
      await fetch('/api/history?id=ALL', { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to clear server history:', err);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.session_id !== sid);
    setSessions(updated);
    saveLocalChatHistory(updated);
    if (selectedSessionId === sid) {
      setSelectedSessionId(updated.length > 0 ? updated[0].session_id : null);
    }
    try {
      await fetch(`/api/history?id=${encodeURIComponent(sid)}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete session on server:', err);
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

          {/* Slide-out Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-3xl flex-col border-l border-[rgba(0,212,255,0.25)] bg-[#070b14]/95 text-slate-100 shadow-[0_0_50px_rgba(0,212,255,0.15)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[rgba(0,212,255,0.15)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.1)] text-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.3)]">
                  <ClockIcon className="h-5 w-5" weight="bold" />
                </div>
                <div>
                  <h2 className="font-mono text-sm font-semibold tracking-wider text-slate-100 uppercase">
                    Previous Voice Sessions
                  </h2>
                  <p className="font-mono text-[11px] text-[rgba(0,212,255,0.6)]">
                    Caller Memory & Spoken Transcripts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {sessions.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400 transition hover:bg-red-500/20"
                    title="Clear all history"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>Clear History</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 transition hover:border-[#00d4ff] hover:text-[#00d4ff]"
                >
                  <XIcon className="h-4 w-4" weight="bold" />
                </button>
              </div>
            </div>

            {/* Body Container */}
            <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
              {/* Left Column: Session List */}
              <div className="flex flex-col border-r border-b border-[rgba(0,212,255,0.1)] bg-[#03060c]/60 p-4 md:col-span-5 md:border-b-0">
                {/* Search Bar */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search previous chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[rgba(0,212,255,0.2)] bg-[#0b1220] px-3.5 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-[#00d4ff] focus:outline-none"
                  />
                </div>

                {/* Session Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {isLoading && sessions.length === 0 && (
                    <div className="animate-pulse py-12 text-center font-mono text-xs text-slate-400">
                      Loading history...
                    </div>
                  )}

                  {!isLoading && filteredSessions.length === 0 && (
                    <div className="py-12 text-center">
                      <ClockIcon className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                      <p className="font-mono text-xs text-slate-400">No previous sessions found</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-600">
                        Connect a voice call to generate session transcripts
                      </p>
                    </div>
                  )}

                  {filteredSessions.map((session) => {
                    const isSelected = activeSession?.session_id === session.session_id;
                    const dateStr = session.created_at
                      ? new Date(session.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recent';

                    return (
                      <div
                        key={session.session_id}
                        onClick={() => setSelectedSessionId(session.session_id)}
                        className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                          isSelected
                            ? 'border-[#00d4ff] bg-[rgba(0,212,255,0.08)] shadow-[0_0_15px_rgba(0,212,255,0.1)]'
                            : 'border-slate-800/80 bg-slate-900/40 hover:border-[rgba(0,212,255,0.3)] hover:bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="line-clamp-1 font-mono text-xs font-medium text-slate-200">
                            {session.title || 'Voice Assistant Call'}
                          </h4>
                          <button
                            onClick={(e) => handleDeleteSession(e, session.session_id)}
                            className="p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                            title="Delete session"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3 text-[rgba(0,212,255,0.6)]" />
                            {dateStr}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                            {session.messages?.length || 0} msgs
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Transcript Detail */}
              <div className="flex flex-col overflow-hidden bg-[#070b14] p-4 md:col-span-7">
                {activeSession ? (
                  <div className="flex h-full flex-col">
                    {/* Active Session Info Header */}
                    <div className="mb-3 border-b border-slate-800 pb-3">
                      <h3 className="font-mono text-sm font-semibold text-[#00d4ff]">
                        {activeSession.title}
                      </h3>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        Session ID: {activeSession.session_id}
                      </p>
                    </div>

                    {/* Transcript Messages List */}
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {activeSession.messages.length === 0 ? (
                        <div className="py-16 text-center font-mono text-xs text-slate-500">
                          No messages recorded in this session transcript.
                        </div>
                      ) : (
                        activeSession.messages.map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div
                              key={msg.id || idx}
                              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                              <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                                {isUser ? (
                                  <>
                                    <span>Caller</span>
                                    <UserIcon className="h-3 w-3 text-cyan-400" />
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-block h-2 w-2 rounded-full bg-[#00d4ff] shadow-[0_0_6px_#00d4ff]" />
                                    <span>ZeroxAI Voice</span>
                                  </>
                                )}
                              </div>
                              <div
                                className={`max-w-[88%] rounded-2xl px-4 py-2.5 font-mono text-xs leading-relaxed ${
                                  isUser
                                    ? 'rounded-br-none border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.15)] text-cyan-100'
                                    : 'rounded-bl-none border border-slate-700/60 bg-slate-800/90 text-slate-200'
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
                    Select a previous session on the left to view transcript details
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
