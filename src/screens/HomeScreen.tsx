import React from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Wallet, Users, Gift, CheckCircle2, Trophy, Check } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';

export const HomeScreen: React.FC = () => {
  const { user, levelDetails, tasks, setActiveTab, claimDailyBonus } = useApp();
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.length - completedCount;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="w-full min-h-screen pb-24 bg-[#f6f7fb]">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-b-[38px] px-6 pt-7 pb-8 text-white shadow-sm bg-gradient-to-br from-[#7412d8] via-[#a31293] via-[#df1466] to-[#fa6d3d]">
        <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-16 right-4 w-48 h-48 rounded-full bg-pink-400/10 pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/80 text-xs font-normal mb-0.5">Welcome to X BOOST 👋</div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">{user.displayName}</h1>
                <span className="inline-flex items-center justify-center bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                  {levelDetails.levelDisplay}
                </span>
              </div>
            </div>
            <div className="w-13 h-13 rounded-full bg-[#5210e6] flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-purple-900/30 border border-white/25 overflow-hidden">
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                user.displayName.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-white/75">TOTAL BALANCE</div>
            <div className="text-[38px] font-extrabold tracking-tight text-white leading-none mt-1">৳ {user.balance.toFixed(2)}</div>
            <div className="flex items-center gap-1.5 text-xs text-white/80 font-normal mt-2">
              <TrendingUp size={14} className="stroke-[2.5]" />
              <span>Total earned: ৳ {user.totalEarned.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="px-4 -mt-3.5 space-y-3 z-10 relative">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActiveTab('withdraw')}
            className="bg-white rounded-[22px] p-4 shadow-sm border border-slate-100/90 flex items-center gap-3.5 text-left transition hover:shadow-md active:scale-[0.98] cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#7c25d3] text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/20">
              <Wallet size={20} />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm leading-tight">Withdraw</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Min: ৳ 1500</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('refer')}
            className="bg-white rounded-[22px] p-4 shadow-sm border border-slate-100/90 flex items-center gap-3.5 text-left transition hover:shadow-md active:scale-[0.98] cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#ff6b4a] text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
              <Users size={20} />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm leading-tight">Refer</div>
              <div className="text-[11px] text-slate-400 mt-0.5">৳ {APP_CONFIG.referralRewardAmount.toFixed(2)} / friend</div>
            </div>
          </button>
        </div>

        {/* Daily Bonus Card */}
        <div className="bg-white rounded-[22px] p-3.5 shadow-sm border border-slate-100/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
              <Gift size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800 text-sm leading-tight truncate">Daily LV Bonus</span>
                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0">
                  {levelDetails.levelDisplay}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Claim your ৳ {levelDetails.dailyReward} daily bonus once...
              </p>
            </div>
          </div>
          <button
            onClick={claimDailyBonus}
            disabled={user.dailyBonusClaimedToday}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition ${
              user.dailyBonusClaimedToday
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#7c25d3] to-[#6366f1] text-white shadow-md shadow-purple-500/20 hover:opacity-95 active:scale-95 cursor-pointer'
            }`}
          >
            {user.dailyBonusClaimedToday ? (
              <>
                <Check size={14} />
                <span>Claimed</span>
              </>
            ) : (
              <>
                <Gift size={14} />
                <span>Claim ৳ {levelDetails.dailyReward}</span>
              </>
            )}
          </button>
        </div>

        {/* Daily Tasks Card */}
        <div className="bg-gradient-to-r from-[#7c25d3] via-[#b81d8f] to-[#e6327e] text-white rounded-[22px] p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Daily Tasks</div>
                <div className="text-[11px] text-white/80 mt-0.5">
                  {pendingCount > 0 ? `${pendingCount} tasks pending` : 'All tasks completed!'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('earn')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full transition active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <span>View</span>
              <span>→</span>
            </button>
          </div>
          <div className="w-full bg-white/20 h-1.5 rounded-full mt-3.5 overflow-hidden">
            <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/80 mt-1.5">
            <span>{completedCount} completed</span>
            <span>{progressPercent}%</span>
          </div>
        </div>

        {/* Two stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[22px] p-4 shadow-sm border border-slate-100/90 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-800 leading-tight">{user.totalReferrals}</div>
              <div className="text-xs text-slate-400 mt-0.5">Total Referrals</div>
            </div>
          </div>
          <div className="bg-white rounded-[22px] p-4 shadow-sm border border-slate-100/90 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <Trophy size={18} />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-800 leading-tight">৳ {user.totalEarned.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Total Earned</div>
            </div>
          </div>
        </div>

        {/* How to earn */}
        <div className="bg-white rounded-[22px] p-4.5 shadow-sm border border-slate-100/90 space-y-3.5">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Gift size={18} className="text-purple-600" />
            <span>How to earn</span>
          </div>
          <div className="space-y-3 text-xs leading-relaxed text-slate-600">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#7c25d3] text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
              <p>Watch 3-step rewarded video ads daily up to the limit ({APP_CONFIG.maxDailyAds} ads/day).</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#7c25d3] text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
              <p>Complete simple tasks like joining channels and following pages.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#7c25d3] text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
              <p>Invite friends with your referral link and get ৳ {APP_CONFIG.referralRewardAmount.toFixed(2)} each.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
