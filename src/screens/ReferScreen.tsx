import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserPlus, Copy, Share2, Trophy, Users, CheckCircle2 } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';

export const ReferScreen: React.FC = () => {
  const { user, leaderboard, referralTiers, referralsList, copyReferralLink, shareReferralLink } = useApp();
  const [referTab, setReferTab] = useState<'leaderboard' | 'referrals'>('leaderboard');

  const userReferralId = user.referralCode || user.telegramId || user.uid;
  const referralUrl = APP_CONFIG.getReferralLink(userReferralId);

  return (
    <div className="w-full min-h-screen pb-24 bg-[#f6f7fb]">
      {/* Top Header */}
      <div className="relative overflow-hidden rounded-b-[38px] px-6 pt-7 pb-8 text-white shadow-sm bg-gradient-to-br from-[#7412d8] via-[#a31293] via-[#df1466] to-[#fa6d3d] flex flex-col items-center text-center">
        <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-16 right-4 w-48 h-48 rounded-full bg-pink-400/10 pointer-events-none" />
        
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-2.5 border border-white/20 shadow-md">
            <UserPlus size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Invite & Earn</h1>
          <p className="text-xs text-white/85 mt-1 font-normal">
            Get ৳ {APP_CONFIG.referralRewardAmount.toFixed(2)} for every friend who joins
          </p>

          {/* Quick Header URL Bar */}
          <div className="w-full mt-4 bg-white/15 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center justify-between border border-white/20 text-xs text-white/95">
            <span className="truncate pr-2 font-mono text-[11px] sm:text-xs">
              {referralUrl}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={copyReferralLink}
                className="p-1 hover:bg-white/20 rounded-lg transition active:scale-95 text-white cursor-pointer"
                title="Copy Link"
                aria-label="Copy referral link to clipboard"
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                onClick={shareReferralLink}
                className="p-1 hover:bg-white/20 rounded-lg transition active:scale-95 text-white cursor-pointer"
                title="Share Link"
                aria-label="Share referral link"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-3.5 space-y-3.5 z-10 relative">
        {/* Total Referrals & Total Earned */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[22px] p-4 shadow-sm border border-slate-100/90 text-center">
            <div className="text-xs text-slate-400 font-medium">Total Referrals</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{user.totalReferrals}</div>
          </div>
          <div className="bg-white rounded-[22px] p-4 shadow-sm border border-slate-100/90 text-center">
            <div className="text-xs text-slate-400 font-medium">Total Earned</div>
            <div className="text-2xl font-bold text-[#7c25d3] mt-1">৳ {user.totalEarned.toFixed(2)}</div>
          </div>
        </div>

        {/* Dedicated Referral Link Card */}
        <div className="bg-white rounded-[22px] p-4.5 shadow-sm border border-slate-100/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-800 text-sm">Your Referral Link</div>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
              +৳ {APP_CONFIG.referralRewardAmount.toFixed(2)} / friend
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-2 overflow-hidden">
            <span className="text-xs font-mono text-slate-800 truncate select-all">
              {referralUrl}
            </span>
            <button
              type="button"
              onClick={shareReferralLink}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition shrink-0 cursor-pointer"
              title="Share Link"
              aria-label="Share referral link"
            >
              <Share2 size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={copyReferralLink}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#7c25d3] to-[#6366f1] text-white font-bold text-sm shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Copy size={16} />
            <span>COPY LINK</span>
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-100 flex items-center">
          <button
            type="button"
            onClick={() => setReferTab('leaderboard')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              referTab === 'leaderboard'
                ? 'bg-gradient-to-r from-[#7c25d3] via-[#b81d8f] to-[#e6327e] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy size={14} />
            <span>Leaderboard</span>
          </button>

          <button
            type="button"
            onClick={() => setReferTab('referrals')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              referTab === 'referrals'
                ? 'bg-gradient-to-r from-[#7c25d3] via-[#b81d8f] to-[#e6327e] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={14} />
            <span>Your Referrals</span>
          </button>
        </div>

        {/* Leaderboard View */}
        {referTab === 'leaderboard' && (
          <div className="space-y-2.5 animate-in fade-in duration-200">
            {leaderboard.map((item) => {
              const isFirst = item.rank === 1;
              const isSecond = item.rank === 2;
              const isThird = item.rank === 3;

              return (
                <div
                  key={item.rank}
                  className={`bg-white rounded-2xl p-3 sm:p-3.5 shadow-sm border flex items-center justify-between gap-3 ${
                    isFirst ? 'border-amber-200/90 shadow-amber-500/5' : 'border-slate-100/90'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 flex items-center justify-center shrink-0">
                      {isFirst && <span className="text-xl">🥇</span>}
                      {isSecond && <span className="text-xl">🥈</span>}
                      {isThird && <span className="text-xl">🥉</span>}
                      {!isFirst && !isSecond && !isThird && (
                        <span className="text-xs font-bold text-slate-500">#{item.rank}</span>
                      )}
                    </div>
                    {item.isCustomIcon ? (
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8a14b5] to-[#c2185b] flex items-center justify-center text-white shrink-0 shadow-sm">
                        <div className="w-4 h-4 border-2 border-white rotate-45" />
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: item.avatarColor || '#334155' }}
                      >
                        {item.avatarText}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{item.name}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-[#7c25d3] text-sm sm:text-base leading-tight">
                      {item.referrals.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">Referrals</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Referrals View */}
        {referTab === 'referrals' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {referralTiers.map((tier) => {
              let circleColor = 'bg-purple-100 text-purple-700';
              let badgeColor = 'bg-purple-100 text-purple-700';

              if (tier.level === 2) {
                circleColor = 'bg-blue-100 text-blue-600';
                badgeColor = 'bg-blue-100 text-blue-600';
              } else if (tier.level === 3) {
                circleColor = 'bg-indigo-100 text-indigo-600';
                badgeColor = 'bg-indigo-100 text-indigo-600';
              }

              return (
                <div key={tier.level} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${circleColor}`}>
                        {tier.level}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{tier.name}</div>
                        <div className="text-[11px] text-slate-400">{tier.commissionLabel}</div>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badgeColor}`}>
                      {tier.usersCount} users
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 text-xs">
                    <span className="text-slate-500">Earned from withdrawal commission:</span>
                    <span className="font-bold text-purple-700">৳ {tier.earnedAmount.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}

            {referralsList.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    <span>Verified Direct Referrals</span>
                  </div>
                  <span className="text-purple-700 text-[11px]">{referralsList.length} confirmed</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto pr-1">
                  {referralsList.map((ref) => (
                    <div key={ref.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {ref.referredDisplayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-xs truncate">
                            {ref.referredDisplayName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            Telegram ID: {ref.referredTelegramId}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 shrink-0">
                        Confirmed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90">
              <div className="text-xs text-slate-400 mb-1.5 font-medium">Your Referral Link</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono truncate text-purple-900">
                  {referralUrl}
                </span>
                <button
                  type="button"
                  onClick={copyReferralLink}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7c25d3] to-[#6366f1] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm hover:opacity-95 active:scale-95 transition cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
