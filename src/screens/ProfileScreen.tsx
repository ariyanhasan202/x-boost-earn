import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  HelpCircle, 
  ShieldAlert, 
  ChevronRight, 
  CheckCircle2, 
  ExternalLink, 
  AlertCircle, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';

export const ProfileScreen: React.FC = () => {
  const { 
    user, 
    levelDetails, 
    setActiveModal, 
    verificationStatus, 
    verificationError,
    reverifyTelegramAccount 
  } = useApp();

  const formattedUsername = user.username 
    ? (user.username.startsWith('@') ? user.username : `@${user.username}`) 
    : 'No Telegram username set';

  const displayedTelegramId = user.isVerified 
    ? (user.telegramId || 'Unavailable') 
    : (user.telegramId ? user.telegramId : 'Unverified');

  return (
    <div className="w-full min-h-screen pb-24 bg-[#f6f7fb]">
      {/* Top Header */}
      <div className="relative overflow-hidden rounded-b-[38px] px-6 pt-8 pb-9 text-white shadow-sm bg-gradient-to-br from-[#7412d8] via-[#a31293] via-[#df1466] to-[#fa6d3d] flex flex-col items-center text-center">
        <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-16 right-4 w-48 h-48 rounded-full bg-pink-400/10 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Avatar with Telegram Photo */}
          <div className="w-20 h-20 rounded-[22px] bg-[#5d17eb] flex items-center justify-center text-white text-3xl font-bold shadow-xl border border-white/20 mb-3 overflow-hidden relative">
            {user.photoUrl ? (
              <img 
                src={user.photoUrl} 
                alt={user.displayName} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
          </div>

          {/* Name */}
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>{user.displayName}</span>
            {user.isVerified && (
              <span title="Cryptographically Verified Telegram Account" className="text-emerald-300 inline-flex">
                <CheckCircle2 size={18} fill="#10b981" className="text-white" />
              </span>
            )}
          </h1>

          {/* Username */}
          <div className="text-xs text-white/80 italic font-normal mt-0.5">
            {formattedUsername}
          </div>

          <div className="text-[11px] text-white/70 font-normal mt-1">
            Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>

          {/* Badges: LV, Real Telegram ID, and Verification */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
            <span className="bg-white/20 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/20">
              {levelDetails.levelDisplay}
            </span>
            <span className="bg-white/20 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/20">
              ID: {displayedTelegramId}
            </span>
            {verificationStatus === 'verifying' ? (
              <span className="bg-purple-500/30 backdrop-blur-md text-purple-100 text-[11px] font-bold px-3 py-1 rounded-full border border-purple-300/40 inline-flex items-center gap-1.5 shadow-sm">
                <Loader2 size={12} className="animate-spin" />
                <span>Verifying...</span>
              </span>
            ) : user.isVerified ? (
              <span className="bg-emerald-500/30 backdrop-blur-md text-emerald-100 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-300/40 inline-flex items-center gap-1 shadow-sm">
                <span>🛡️</span>
                <span>Telegram Verified</span>
              </span>
            ) : (
              <span className="bg-white/10 backdrop-blur-md text-white/70 text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 inline-flex items-center gap-1">
                <span>Unverified</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-3.5 space-y-3.5 z-10 relative">
        {/* Verification banner if unverified */}
        {!user.isVerified && (
          <div className="bg-white rounded-[22px] p-4 shadow-sm border border-amber-200/80 bg-gradient-to-r from-amber-50/50 to-orange-50/40 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-950 text-xs">
                Telegram Account Unverified
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed mt-0.5">
                {verificationError 
                  ? `Verification note: ${verificationError}. Please retry or open inside Telegram.` 
                  : 'Open this app inside our official Telegram bot to verify your account.'}
              </p>
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => reverifyTelegramAccount()}
                  disabled={verificationStatus === 'verifying'}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white px-2.5 py-1.5 rounded-lg border border-purple-200 shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw size={11} className={verificationStatus === 'verifying' ? 'animate-spin' : ''} />
                  <span>{verificationStatus === 'verifying' ? 'Checking...' : 'Retry Verification'}</span>
                </button>
                {APP_CONFIG.botUsername && (
                  <button
                    onClick={() => {
                      window.open(`https://t.me/${APP_CONFIG.botUsername}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white/80 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    <span>Open in @{APP_CONFIG.botUsername}</span>
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3 Statistic Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100/90 text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#7c25d3] ring-4 ring-purple-100 mx-auto mb-2" />
            <div className="font-bold text-[#7c25d3] text-sm sm:text-base leading-tight truncate">
              ৳ {user.balance.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400 mt-1">Balance</div>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100/90 text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e2136e] ring-4 ring-pink-100 mx-auto mb-2" />
            <div className="font-bold text-[#e2136e] text-sm sm:text-base leading-tight truncate">
              ৳ {user.totalWithdrawn.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400 mt-1">Withdrawn</div>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100/90 text-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] ring-4 ring-emerald-100 mx-auto mb-2" />
            <div className="font-bold text-[#10b981] text-sm sm:text-base leading-tight">
              {user.tasksCompleted}
            </div>
            <div className="text-xs text-slate-400 mt-1">Tasks Done</div>
          </div>
        </div>

        {/* Menu Cards */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100/90 divide-y divide-slate-100 overflow-hidden">
          {/* Help & Support */}
          <button
            onClick={() => setActiveModal('support')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition active:bg-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0">
                <HelpCircle size={20} />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm leading-tight">
                  Help & Support
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Contact our community & admin
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* App Rules & Policy */}
          <button
            onClick={() => setActiveModal('rules')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition active:bg-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm leading-tight">
                  App Rules & Policy
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Minimum withdrawal ৳ 1500 & guidelines
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
