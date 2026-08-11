'use client';

import { useState } from 'react';
import { Phone, PhoneCall, PhoneOff, User, X, Delete, RefreshCw, Volume2 } from 'lucide-react';

interface TelephoneDialerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCall: () => void;
}

export const TelephoneDialerModal = ({
  isOpen,
  onClose,
  onStartCall,
}: TelephoneDialerModalProps) => {
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [customerName, setCustomerName] = useState('Ramesh Kumar');
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'connected'>('idle');
  const [timer, setTimer] = useState(0);

  if (!isOpen) return null;

  const handleKeyPress = (val: string) => {
    if (callStatus !== 'idle') return;
    setPhoneNumber((prev) => prev + val);
  };

  const handleBackspace = () => {
    if (callStatus !== 'idle') return;
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleDial = async () => {
    setCallStatus('dialing');

    try {
      // Trigger API endpoint for outbound call setup
      const res = await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: phoneNumber, name: customerName }),
      });

      const data = await res.json();
      console.log('Outbound call API result:', data);

      setTimeout(() => {
        setCallStatus('connected');
        // Launch voice call session on UI
        onStartCall();
      }, 1500);
    } catch (err) {
      console.error('Call failed:', err);
      setCallStatus('idle');
    }
  };

  const handleEndCall = () => {
    setCallStatus('idle');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl border border-[#00d4ff]/40 bg-[#071220]/95 p-6 font-mono text-[#00d4ff] shadow-[0_0_50px_rgba(0,212,255,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#00d4ff]/20 pb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#00d4ff]/10 text-[#00d4ff]">
              <PhoneCall className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#10b981] animate-ping" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                Telephone Dialer
              </h2>
              <p className="text-[10px] text-[#00d4ff]/60 uppercase tracking-widest">
                Local Commerce Outbound Call
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status indicator */}
        <div className="my-4 rounded-xl border border-[#00d4ff]/20 bg-[#040914] p-3 text-center">
          {callStatus === 'idle' && (
            <div className="text-xs text-[#00d4ff]/70">READY TO PLACE OUTBOUND CALL</div>
          )}
          {callStatus === 'dialing' && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>DIALING {phoneNumber}...</span>
            </div>
          )}
          {callStatus === 'connected' && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#10b981]">
              <Volume2 className="h-4 w-4 animate-pulse" />
              <span>CALL CONNECTED — POOJA AGENT (hi-IN)</span>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          {/* Customer Name */}
          <div>
            <label className="text-[10px] text-[#00d4ff]/60 uppercase tracking-wider block mb-1">
              Customer Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-[#00d4ff]/40" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={callStatus !== 'idle'}
                className="w-full rounded-xl border border-[#00d4ff]/30 bg-[#0b182b] py-2 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:border-[#00d4ff] focus:outline-none"
                placeholder="Customer Name"
              />
            </div>
          </div>

          {/* Phone / SIP Address */}
          <div>
            <label className="text-[10px] text-[#00d4ff]/60 uppercase tracking-wider block mb-1">
              Destination Phone / SIP Address
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#00d4ff]/40" />
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={callStatus !== 'idle'}
                className="w-full rounded-xl border border-[#00d4ff]/30 bg-[#0b182b] py-2 pl-9 pr-8 text-xs text-white placeholder-gray-500 focus:border-[#00d4ff] focus:outline-none font-mono"
                placeholder="+91 98765 43210 or sip:user@linphone"
              />
              {callStatus === 'idle' && (
                <button
                  onClick={handleBackspace}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-white"
                >
                  <Delete className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setPhoneNumber('+91 98765 43210')}
              disabled={callStatus !== 'idle'}
              className="flex-1 rounded-lg border border-[#00d4ff]/20 bg-[#091526] py-1 text-[10px] text-[#00d4ff]/80 hover:border-[#00d4ff] hover:bg-[#00d4ff]/10"
            >
              Twilio PSTN (+91)
            </button>
            <button
              onClick={() => setPhoneNumber('sip:demo@sip.linphone.org')}
              disabled={callStatus !== 'idle'}
              className="flex-1 rounded-lg border border-[#00d4ff]/20 bg-[#091526] py-1 text-[10px] text-[#00d4ff]/80 hover:border-[#00d4ff] hover:bg-[#00d4ff]/10"
            >
              Linphone SIP
            </button>
          </div>
        </div>

        {/* Dial Pad */}
        <div className="my-5 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              disabled={callStatus !== 'idle'}
              className="flex h-11 items-center justify-center rounded-xl border border-[#00d4ff]/20 bg-[#0c1c33]/80 text-base font-bold text-white shadow-inner transition hover:border-[#00d4ff] hover:bg-[#00d4ff]/20 active:scale-95 disabled:opacity-50"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Call Action Button */}
        <div className="pt-2">
          {callStatus === 'idle' ? (
            <button
              onClick={handleDial}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition hover:from-emerald-400 hover:to-teal-500 active:scale-98"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Make Outbound Call</span>
            </button>
          ) : (
            <button
              onClick={handleEndCall}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] transition hover:from-rose-500 hover:to-red-600 active:scale-98"
            >
              <PhoneOff className="h-4 w-4" />
              <span>End Telephone Call</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
