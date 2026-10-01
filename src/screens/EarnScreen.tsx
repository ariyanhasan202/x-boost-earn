import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Play, CheckCircle2, Gift, Send, Coins, ExternalLink, Check, Loader2 } from 'lucide-react';
import { TaskItem } from '../types';

const STEP1_URL = "https://www.profitableratecpmnetwork.com/fgrit5jz?key=e65cf7bc7f3056f69c8d0e969a21f7f1";
const STEP2_URL = "/ad/step/2";
const STEP3_URL = "/ad/step/3";

export const EarnScreen: React.FC = () => {
  const { 
    user, 
    tasks, 
    joinTask, 
    showToast,
    watchSession,
    refreshAdSession,
    startWatchingAd,
    completeAdStep,
    claimAdReward
  } = useApp();

  // Completed steps in current cycle (0, 1, or 2)
  const completedCount = watchSession?.completedCount ?? 0;
  const currentStep = Math.min(3, completedCount + 1);

  // Active watching / return tracking states
  const [isOpeningAd, setIsOpeningAd] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [activeOpenStep, setActiveOpenStep] = useState<number | null>(null);

  // Step 3 state tracking: 'IDLE' | 'STEP3_PRIMARY' | 'STEP3_FALLBACK'
  const step3StateRef = useRef<'IDLE' | 'STEP3_PRIMARY' | 'STEP3_FALLBACK'>('IDLE');
  const adOpenTimestampRef = useRef<number>(0);
  const activeOpenStepRef = useRef<number | null>(null);
  activeOpenStepRef.current = activeOpenStep;
  const isVerifyingRef = useRef<boolean>(false);
  isVerifyingRef.current = isVerifying;
  const isDebouncingRef = useRef<boolean>(false);

  // Fetch or initialize session on mount
  useEffect(() => {
    refreshAdSession();
  }, [refreshAdSession]);

  // Listen for Step 3 Primary / Fallback events from the ad window
  useEffect(() => {
    const handleAdMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data) return;
        if (data.type === 'STEP_3_PRIMARY_LOADED') {
          console.log('[ADS] Step 3 primary loaded');
        } else if (data.type === 'STEP_3_FALLBACK_TRIGGERED') {
          if (step3StateRef.current === 'STEP3_PRIMARY') {
            console.warn('[ADS] Step 3 primary failed');
            console.log('[ADS] Step 3 fallback started');
            step3StateRef.current = 'STEP3_FALLBACK';
          }
        }
      } catch {
        // Safe ignore
      }
    };
    window.addEventListener('message', handleAdMessage);
    return () => {
      window.removeEventListener('message', handleAdMessage);
    };
  }, []);

  // Verify a completed ad step
  const verifyStep = useCallback(async (stepToVerify: number) => {
    if (isVerifyingRef.current) return;
    setIsVerifying(true);
    try {
      const success = await completeAdStep();
      if (success) {
        setActiveOpenStep(null);
        if (stepToVerify === 1) {
          console.log('[ADS] Step 1 completed');
          showToast('✓ Step 1 completed!', 'success');
        } else if (stepToVerify === 2) {
          console.log('[ADS] Step 2 completed');
          showToast('✓ Step 2 completed!', 'success');
        } else if (stepToVerify === 3) {
          console.log('[ADS] Step 3 completed');
          step3StateRef.current = 'IDLE';
          // Immediately claim cycle reward and add balance to user
          showToast('✓ Step 3 completed! Crediting ৳ 2.00 reward...', 'info');
          const claimed = await claimAdReward();
          if (claimed) {
            console.log('[ADS] Cycle completed');
            console.log('[ADS] Starting new cycle');
            // The step state is reset to currentStep = 1
            showToast('✓ Cycle completed! +৳ 2.00 added to your balance!', 'success');
          }
        }
      } else {
        showToast('Could not verify ad completion. Please try again.', 'error');
        setActiveOpenStep(null);
      }
    } catch {
      showToast('Network error verifying ad step', 'error');
      setActiveOpenStep(null);
    } finally {
      setIsVerifying(false);
    }
  }, [completeAdStep, claimAdReward, showToast]);

  // Return-to-App Detection
  useEffect(() => {
    const handleReturn = () => {
      if (!document.hidden && activeOpenStepRef.current && !isVerifyingRef.current) {
        const elapsed = Date.now() - adOpenTimestampRef.current;
        // Require at least 2.5 seconds dwell time on ad destination
        if (elapsed >= 2500) {
          verifyStep(activeOpenStepRef.current);
        }
      }
    };

    const handleFocus = () => {
      if (activeOpenStepRef.current && !isVerifyingRef.current) {
        const elapsed = Date.now() - adOpenTimestampRef.current;
        if (elapsed >= 2500) {
          verifyStep(activeOpenStepRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleFocus);
    };
  }, [verifyStep]);

  // Main Action: User taps [ WATCH AD ]
  const handleWatchAd = async () => {
    // Prevent duplicate rapid taps
    if (isDebouncingRef.current || isOpeningAd || isVerifying) return;
    isDebouncingRef.current = true;
    setTimeout(() => {
      isDebouncingRef.current = false;
    }, 800);

    // If already waiting for return, trigger verification on tap
    if (activeOpenStep !== null) {
      verifyStep(activeOpenStep);
      return;
    }

    if (user.dailyAdsWatched >= user.dailyAdsLimit) {
      showToast("Daily ad limit reached.", 'info');
      return;
    }

    setIsOpeningAd(true);
    try {
      let currentSession = watchSession;
      
      // If starting fresh cycle (step 1) or session claimed, start new session
      if (!currentSession || currentSession.rewardClaimed || currentSession.completedCount === 0) {
        console.log('[ADS] Cycle started');
        currentSession = await startWatchingAd();
      }

      const stepToOpen = (currentSession?.completedCount ?? 0) + 1;
      adOpenTimestampRef.current = Date.now();
      setActiveOpenStep(stepToOpen);

      // Log step start
      if (stepToOpen === 1) {
        console.log('[ADS] Step 1 started');
      } else if (stepToOpen === 2) {
        console.log('[ADS] Step 2 started');
      } else if (stepToOpen === 3) {
        step3StateRef.current = 'STEP3_PRIMARY';
        console.log('[ADS] Step 3 primary started');
      }

      // Open the exact configured ad source for the current step
      let targetUrl = STEP1_URL;
      if (stepToOpen === 2) targetUrl = STEP2_URL;
      if (stepToOpen === 3) targetUrl = STEP3_URL;

      const tg = (window as any).Telegram?.WebApp;
      if (stepToOpen === 1 && tg && typeof tg.openLink === 'function') {
        tg.openLink(targetUrl);
      } else {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      showToast('Could not open advertisement', 'error');
      setActiveOpenStep(null);
    } finally {
      setIsOpeningAd(false);
    }
  };

  const renderTaskIcon = (task: TaskItem) => {
    switch (task.iconType) {
      case 'gift':
        return (
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Gift size={22} />
          </div>
        );
      case 'telegram':
        return (
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0">
            <Send size={20} className="rotate-45" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
            <Coins size={22} />
          </div>
        );
    }
  };

  return (
    <div className="w-full min-h-screen pb-24 bg-[#f6f7fb]">
      {/* Top Header */}
      <div className="relative overflow-hidden rounded-b-[38px] px-6 pt-7 pb-8 text-white shadow-sm bg-gradient-to-br from-[#7412d8] via-[#a31293] via-[#df1466] to-[#fa6d3d]">
        <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-16 right-4 w-48 h-48 rounded-full bg-pink-400/10 pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-white/80">REWARDED ADS</div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">Earn</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/80 font-normal">Per Cycle</div>
            <div className="text-xl font-bold text-white tracking-tight mt-0.5">
              ৳ 2.00 <span className="text-xs font-normal text-white/80">(3 Ads)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-3.5 space-y-4 z-10 relative">
        
        {/* REWARDED AD TASK CARD: CONTINUOUS 3-STEP CYCLE FLOW */}
        <div className="bg-white rounded-[22px] p-5 shadow-sm border border-slate-100/90 text-center">
          
          {/* Progress Indicator: Step 1 of 3, Step 2 of 3, Step 3 of 3 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide text-purple-700 uppercase bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                Step {currentStep} of 3
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Reward: ৳ 2.00
              </span>
            </div>
            <div className="text-xs font-bold text-slate-400">
              {user.dailyAdsWatched} / {user.dailyAdsLimit} Today
            </div>
          </div>

          {/* Clean Step Dots */}
          <div className="flex items-center justify-center gap-3 py-1 mb-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                completedCount >= 1 ? "bg-emerald-500 text-white" : currentStep === 1 ? "bg-purple-600 text-white ring-2 ring-purple-300" : "bg-slate-200 text-slate-500"
              }`}>
                {completedCount >= 1 ? "✓" : "1"}
              </span>
              <span className={`text-xs font-bold ${completedCount >= 1 ? "text-emerald-600" : currentStep === 1 ? "text-purple-700" : "text-slate-400"}`}>
                Ad 1
              </span>
            </div>
            <span className="text-slate-300 text-xs">•</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                completedCount >= 2 ? "bg-emerald-500 text-white" : currentStep === 2 ? "bg-purple-600 text-white ring-2 ring-purple-300" : "bg-slate-200 text-slate-500"
              }`}>
                {completedCount >= 2 ? "✓" : "2"}
              </span>
              <span className={`text-xs font-bold ${completedCount >= 2 ? "text-emerald-600" : currentStep === 2 ? "text-purple-700" : "text-slate-400"}`}>
                Ad 2
              </span>
            </div>
            <span className="text-slate-300 text-xs">•</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                completedCount >= 3 ? "bg-emerald-500 text-white" : currentStep === 3 ? "bg-purple-600 text-white ring-2 ring-purple-300" : "bg-slate-200 text-slate-500"
              }`}>
                {completedCount >= 3 ? "✓" : "3"}
              </span>
              <span className={`text-xs font-bold ${completedCount >= 3 ? "text-emerald-600" : currentStep === 3 ? "text-purple-700" : "text-slate-400"}`}>
                Ad 3
              </span>
            </div>
          </div>

          {/* Status Hint */}
          <div className="text-xs text-slate-500 mb-3.5 min-h-[18px]">
            {isVerifying ? (
              <span className="text-purple-600 font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Verifying Step {activeOpenStep || currentStep}...</span>
              </span>
            ) : activeOpenStep !== null ? (
              <span className="text-emerald-600 font-semibold">
                Ad opened! Return to X BOOST or tap below to verify.
              </span>
            ) : (
              <span>Tap below to start Step {currentStep} advertisement.</span>
            )}
          </div>

          {/* THE ONLY PRIMARY ACTION BUTTON: [ WATCH AD ] */}
          <button
            type="button"
            onClick={handleWatchAd}
            disabled={user.dailyAdsWatched >= user.dailyAdsLimit || isOpeningAd}
            className={`w-full py-4 px-4 rounded-2xl font-black text-base shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              activeOpenStep !== null
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white shadow-emerald-500/25"
                : "bg-gradient-to-r from-[#7c25d3] via-[#b81d8f] to-[#6366f1] text-white shadow-purple-600/30 hover:opacity-95"
            }`}
          >
            {isVerifying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>VERIFYING STEP {activeOpenStep || currentStep}...</span>
              </>
            ) : isOpeningAd ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>OPENING AD...</span>
              </>
            ) : activeOpenStep !== null ? (
              <>
                <Check size={18} />
                <span>VERIFY STEP {activeOpenStep} COMPLETED</span>
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                <span>WATCH AD</span>
              </>
            )}
          </button>
        </div>

        {/* Telegram Tasks Section */}
        <div className="pt-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base mb-3">
            <CheckCircle2 size={18} className="text-[#7c25d3]" />
            <span>Tasks</span>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => {
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-[22px] p-3.5 sm:p-4 shadow-sm border border-slate-100/90 flex items-center justify-between gap-3 transition hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {renderTaskIcon(task)}
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm leading-tight truncate">{task.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{task.description}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="bg-[#fdf2f8] text-[#db2777] font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-pink-100/80">
                          + ৳ {task.reward.toFixed(2)}
                        </span>
                        <span className="bg-slate-100 text-slate-600 font-semibold text-[10px] px-2 py-0.5 rounded-md">
                          {task.categoryBadge}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-100">
                        <Check size={14} />
                        <span>Done</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => joinTask(task.id)}
                        className="border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 active:scale-95 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>Join</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
