import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  UserProfile, 
  TaskItem, 
  WithdrawalTransaction, 
  NavTab, 
  PaymentMethod,
  LeaderboardUser,
  ReferralTierData,
  ReferralRecord
} from '../types';
import { supabaseBackend } from '../services/supabaseService';
import { calculateUserLevel, LevelDetails } from '../services/levelSystem';
import { APP_CONFIG } from '../config/appConfig';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type VerificationState = 'idle' | 'verifying' | 'verified' | 'unverified' | 'failed';

export interface WatchSessionState {
  sessionId: string;
  completedCount: number;
  totalRequired: number;
  rewardEligible: boolean;
  rewardClaimed: boolean;
  rewardAmount: number;
}

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: UserProfile;
  levelDetails: LevelDetails;
  tasks: TaskItem[];
  withdrawals: WithdrawalTransaction[];
  leaderboard: LeaderboardUser[];
  referralTiers: ReferralTierData[];
  referralsList: ReferralRecord[];
  toasts: ToastInfo[];
  verificationStatus: VerificationState;
  verificationError: string | null;
  reverifyTelegramAccount: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  claimDailyBonus: () => Promise<boolean>;
  startWatchingAd: () => Promise<WatchSessionState | null>;
  isWatchingAd: boolean;
  closeAdModal: () => void;
  watchSession: WatchSessionState | null;
  refreshAdSession: () => Promise<void>;
  completeAdStep: () => Promise<boolean>;
  claimAdReward: () => Promise<boolean>;
  isClaimingReward: boolean;
  joinTask: (taskId: string) => void;
  closeTaskModal: () => void;
  activeVerifyingTaskId: string | null;
  verifyTask: (taskId: string) => Promise<boolean>;
  submitWithdrawal: (method: PaymentMethod, accountNumber: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  resetToInitialState: () => void;
  addDemoBalance: (amount: number) => void;
  copyReferralLink: () => void;
  shareReferralLink: () => void;
  activeModal: 'support' | 'rules' | 'share' | 'faucet' | null;
  setActiveModal: (modal: 'support' | 'rules' | 'share' | 'faucet' | null) => void;
  simulateSingleReferral: () => Promise<void>;
  simulateMilestoneReferrals: (targetCount: number) => Promise<void>;
  testDuplicateReferral: () => Promise<void>;
  testSelfReferral: () => Promise<void>;
  testDoubleDailyClaim: () => Promise<void>;
}

export const OFFICIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Welcome Bonus',
    description: 'Join our official leader & admin group',
    reward: 50.00,
    categoryBadge: 'JOIN BONUS',
    iconType: 'gift',
    channelUrl: 'https://t.me/colour_trading_leder_admin_group',
    status: 'pending'
  },
  {
    id: 'task-2',
    title: 'Payment Channel',
    description: 'Subscribe to our payment proof channel',
    reward: 20.00,
    categoryBadge: 'TELEGRAM',
    iconType: 'telegram',
    channelUrl: 'https://t.me/x_bost_incoming',
    status: 'pending'
  },
  {
    id: 'task-3',
    title: 'Giveaway',
    description: 'Join developer giveaway & special perks',
    reward: 20.00,
    categoryBadge: 'OTHER',
    iconType: 'other',
    channelUrl: 'https://t.me/devloper_solution_bd',
    status: 'pending'
  },
  {
    id: 'task-4',
    title: 'Official Channel',
    description: 'Follow our official X BOOST community channel',
    reward: 20.00,
    categoryBadge: 'TELEGRAM',
    iconType: 'telegram',
    channelUrl: 'https://t.me/xboost_comionitiy',
    status: 'pending'
  }
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [watchSession, setWatchSession] = useState<WatchSessionState | null>(null);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [activeVerifyingTaskId, setActiveVerifyingTaskId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'support' | 'rules' | 'share' | 'faucet' | null>(null);

  // Initial user state
  const [user, setUser] = useState<UserProfile>(() => supabaseBackend.getCachedUser());
  const [verificationStatus, setVerificationStatus] = useState<VerificationState>('idle');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const inFlightVerification = useRef<boolean>(false);

  const [referralsList, setReferralsList] = useState<ReferralRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>(OFFICIAL_TASKS);
  const [withdrawals, setWithdrawals] = useState<WithdrawalTransaction[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Synchronize completed tasks from database
  const syncTasksWithServer = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/tasks/status?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.completedTasks)) {
        const completedSet = new Set<string>(data.completedTasks);
        setTasks(
          OFFICIAL_TASKS.map((t) => ({
            ...t,
            status: completedSet.has(t.id) ? ('completed' as const) : ('pending' as const)
          }))
        );
      }
    } catch (err) {
      console.warn('Error syncing task status:', err);
    }
  }, []);

  // Authoritative Database Refresh for referrals, profile, and withdrawals
  const refreshDatabaseData = useCallback(async (userId?: string, telegramId?: string) => {
    const activeUid = userId || user.uid;
    const activeTgId = telegramId || user.telegramId;

    // 1. Fetch user from Supabase/server
    const dbUser = await supabaseBackend.fetchAuthoritativeUser(activeUid, activeTgId);
    if (dbUser) {
      setUser(dbUser);
    }

    // 2. Fetch referrals from Supabase/server
    const dbRefs = await supabaseBackend.fetchAuthoritativeReferrals(activeUid, activeTgId);
    if (Array.isArray(dbRefs)) {
      setReferralsList(dbRefs);
    }

    // 3. Fetch withdrawals from database
    const dbWithdrawals = await supabaseBackend.fetchAuthoritativeWithdrawals(activeUid, activeTgId);
    if (Array.isArray(dbWithdrawals)) {
      setWithdrawals(dbWithdrawals);
    }

    if (activeUid) {
      syncTasksWithServer(activeUid);
    }
  }, [user.uid, user.telegramId, syncTasksWithServer]);

  // Periodic polling for status updates (e.g. withdrawal status updated via Telegram reply)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user.uid && user.uid !== '00000000-0000-4000-8000-000000000001') {
        supabaseBackend.fetchAuthoritativeWithdrawals(user.uid, user.telegramId).then((wList) => {
          if (Array.isArray(wList)) {
            setWithdrawals(wList);
          }
        }).catch(() => {});
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [user.uid, user.telegramId]);

  // Restore active watch session on mount
  useEffect(() => {
    const activeUid = user.uid;
    if (activeUid) {
      fetch(`/api/ads/session/current?userId=${encodeURIComponent(activeUid)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.session) {
            setWatchSession(res.session);
          }
        })
        .catch(() => {});
    }
  }, [user.uid]);

  // Telegram initData detector
  const detectTelegramInitData = useCallback(async (maxWaitMs = 3000, intervalMs = 100): Promise<{ initData: string; startParam: string | null; unsafeUser: any } | null> => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch {}

        if (typeof tg.initData === 'string' && tg.initData.trim().length > 0) {
          const urlParams = new URLSearchParams(window.location.search);
          const startParam = 
            urlParams.get('start') || 
            urlParams.get('tgWebAppStartParam') ||
            tg.initDataUnsafe?.start_param || null;
          return { initData: tg.initData.trim(), startParam, unsafeUser: tg.initDataUnsafe?.user || null };
        }

        if (tg.initDataUnsafe?.user?.id) {
          const urlParams = new URLSearchParams(window.location.search);
          const startParam = urlParams.get('start') || tg.initDataUnsafe?.start_param || null;
          return { initData: tg.initData || '', startParam, unsafeUser: tg.initDataUnsafe.user };
        }
      }

      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const fromHash = hashParams.get('tgWebAppData');
        if (fromHash) {
          return {
            initData: decodeURIComponent(fromHash),
            startParam: hashParams.get('tgWebAppStartParam') || null,
            unsafeUser: null
          };
        }
      }

      if (window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        const fromSearch = searchParams.get('tgWebAppData');
        if (fromSearch) {
          return {
            initData: decodeURIComponent(fromSearch),
            startParam: searchParams.get('start') || null,
            unsafeUser: null
          };
        }
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
  }, []);

  // Cryptographic Telegram Verification and Startup Database Sync
  const executeVerification = useCallback(async (isManualRetry = false) => {
    if (inFlightVerification.current) return;
    inFlightVerification.current = true;
    setVerificationStatus('verifying');
    setVerificationError(null);

    try {
      const detected = await detectTelegramInitData();
      if (detected && (detected.initData || detected.unsafeUser)) {
        const res = await fetch('/api/telegram-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: detected.initData || '',
            startParam: detected.startParam,
            unsafeUser: detected.unsafeUser || null,
            currentUserId: user.uid
          })
        });

        const json = await res.json();
        if (res.ok && json.verified && json.profile) {
          const parsed = supabaseBackend.parseUserProfile(json.profile);
          supabaseBackend.setCachedUser(parsed);
          setUser(parsed);
          setVerificationStatus('verified');
          setVerificationError(null);

          if (json.referralConfirmed) {
            showToast('🎉 Referral confirmed! Welcome bonus credited.', 'success');
          } else if (isManualRetry) {
            showToast('✅ Telegram Profile Verified: ' + parsed.displayName, 'success');
          }

          const dbRefs = await supabaseBackend.fetchAuthoritativeReferrals(parsed.uid, parsed.telegramId);
          setReferralsList(dbRefs);
          const dbWithdrawals = await supabaseBackend.fetchAuthoritativeWithdrawals(parsed.uid, parsed.telegramId);
          setWithdrawals(dbWithdrawals);
          syncTasksWithServer(parsed.uid);
        } else {
          setVerificationStatus('failed');
          setVerificationError(json.error || 'Verification failed');
          if (isManualRetry) {
            showToast(`Verification: ${json.error || 'Failed'}`, 'error');
          }
        }
      } else {
        const idToCheck = user.telegramId || user.uid;
        try {
          const statusRes = await fetch(`/api/telegram-verify-status?telegramId=${encodeURIComponent(idToCheck)}&userId=${encodeURIComponent(user.uid)}`);
          const statusJson = await statusRes.json();
          if (statusJson.verified && statusJson.profile) {
            const parsed = supabaseBackend.parseUserProfile(statusJson.profile);
            supabaseBackend.setCachedUser(parsed);
            setUser(parsed);
            setVerificationStatus('verified');
            const dbRefs = await supabaseBackend.fetchAuthoritativeReferrals(parsed.uid, parsed.telegramId);
            setReferralsList(dbRefs);
            const dbWithdrawals = await supabaseBackend.fetchAuthoritativeWithdrawals(parsed.uid, parsed.telegramId);
            setWithdrawals(dbWithdrawals);
            syncTasksWithServer(parsed.uid);
            return;
          }
        } catch {}

        setVerificationStatus('unverified');
        const dbRefs = await supabaseBackend.fetchAuthoritativeReferrals(user.uid);
        setReferralsList(dbRefs);
        const dbWithdrawals = await supabaseBackend.fetchAuthoritativeWithdrawals(user.uid);
        setWithdrawals(dbWithdrawals);
        if (isManualRetry) {
          showToast('Please open this app inside Telegram to verify your account.', 'info');
        }
      }
    } catch (e: any) {
      console.warn('Telegram verification exception:', e);
      setVerificationStatus('failed');
      setVerificationError(e.message || 'Verification error');
    } finally {
      inFlightVerification.current = false;
    }
  }, [detectTelegramInitData, user.uid, user.telegramId, showToast, syncTasksWithServer]);

  // Run on initial mount
  useEffect(() => {
    executeVerification(false);
  }, []);

  const reverifyTelegramAccount = useCallback(async () => {
    await executeVerification(true);
  }, [executeVerification]);

  const levelDetails = calculateUserLevel(user.totalReferrals || 0);

  // Claim Daily Bonus
  const claimDailyBonus = async (): Promise<boolean> => {
    const res = await supabaseBackend.claimDailyReward(user.uid, user.telegramId);
    if (!res.success) {
      showToast(res.error || 'Daily reward already claimed today!', 'error');
      return false;
    }

    if (res.user) {
      setUser(res.user);
    } else if (res.newBalance !== undefined) {
      setUser((prev) => ({
        ...prev,
        balance: res.newBalance!,
        dailyBonusClaimedToday: true
      }));
    }

    showToast(`৳ ${res.claimedReward} Daily ${levelDetails.levelDisplay} Bonus claimed successfully!`, 'success');
    return true;
  };

  const refreshAdSession = async () => {
    if (!user.uid) return;
    try {
      const res = await fetch(`/api/ads/session/current?userId=${encodeURIComponent(user.uid)}`);
      const data = await res.json();
      if (data.success && data.session && !data.session.rewardClaimed) {
        setWatchSession(data.session);
      } else {
        setWatchSession(null);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    refreshAdSession();
  }, [user.uid]);

  // Rewarded Ad System
  const startWatchingAd = async (): Promise<WatchSessionState | null> => {
    if (user.dailyAdsWatched >= user.dailyAdsLimit) {
      showToast("You have reached today's limit of 300 ads.", 'info');
      return null;
    }

    try {
      const res = await fetch('/api/ads/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (data.success && data.session) {
        setWatchSession(data.session);
        setIsWatchingAd(true);
        return data.session;
      } else {
        showToast(data.error || 'Could not start ad session', 'error');
        return null;
      }
    } catch {
      showToast('Network error starting ad session', 'error');
      return null;
    }
  };

  const closeAdModal = () => {
    setIsWatchingAd(false);
  };

  // Step complete handler (Automatic step progression)
  const completeAdStep = async (): Promise<boolean> => {
    if (!watchSession) return false;
    const nextStep = watchSession.completedCount + 1;
    try {
      const res = await fetch('/api/ads/session/step-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: watchSession.sessionId,
          userId: user.uid,
          step: nextStep
        })
      });
      const data = await res.json();
      if (data.success && data.session) {
        setWatchSession(data.session);
        return true;
      } else {
        showToast(data.error || 'Could not record ad step', 'error');
        return false;
      }
    } catch {
      showToast('Connection error updating ad step', 'error');
      return false;
    }
  };

  // Claim final reward after all 3 ads are legitimately completed
  const claimAdReward = async (): Promise<boolean> => {
    if (!watchSession) return false;
    if (isClaimingReward) return false;
    setIsClaimingReward(true);

    try {
      const res = await fetch('/api/ads/session/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: watchSession.sessionId,
          userId: user.uid,
          telegramId: user.telegramId
        })
      });

      const data = await res.json();
      if (res.status === 409 || data.error === 'REWARD_ALREADY_CLAIMED') {
        showToast('⚠️ Reward was already claimed for this session!', 'info');
        setIsWatchingAd(false);
        setWatchSession(null);
        return false;
      }

      if (data.success && data.newBalance !== undefined) {
        const reward = data.rewardCredited || 2.00;
        setUser((prev) => ({
          ...prev,
          balance: data.newBalance,
          dailyAdsWatched: data.dailyAdsWatched !== undefined ? data.dailyAdsWatched : prev.dailyAdsWatched + 1,
          totalEarned: +(prev.totalEarned + reward).toFixed(2)
        }));
        setIsWatchingAd(false);
        setWatchSession(null);
        showToast(`🎉 3/3 Ad session verified! +৳ ${reward.toFixed(2)} reward credited to balance.`, 'success');
        refreshDatabaseData();
        return true;
      } else {
        showToast(data.error || 'Failed to claim reward. Please ensure 3/3 ads are completed.', 'error');
        return false;
      }
    } catch (err: any) {
      showToast('Error claiming reward: ' + (err.message || 'Network error'), 'error');
      return false;
    } finally {
      setIsClaimingReward(false);
    }
  };

  const joinTask = (taskId: string) => {
    if (!taskId) {
      setActiveVerifyingTaskId(null);
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === 'completed') {
      showToast('This task is already completed.', 'info');
      return;
    }
    setActiveVerifyingTaskId(taskId);
  };

  const closeTaskModal = () => {
    setActiveVerifyingTaskId(null);
  };

  const verifyTask = async (taskId: string): Promise<boolean> => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;
    if (task.status === 'completed') {
      showToast('This task is already completed.', 'info');
      return false;
    }

    try {
      const res = await fetch('/api/tasks/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          taskId: task.id,
          telegramId: user.telegramId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updatedTasks = tasks.map((t) => 
          t.id === taskId ? { ...t, status: 'completed' as const } : t
        );
        setTasks(updatedTasks);
        setUser((prev) => ({
          ...prev,
          balance: data.newBalance !== undefined ? data.newBalance : +(prev.balance + task.reward).toFixed(2),
          totalEarned: +(prev.totalEarned + task.reward).toFixed(2),
          tasksCompleted: data.tasksCompleted !== undefined ? data.tasksCompleted : prev.tasksCompleted + 1
        }));
        setActiveVerifyingTaskId(null);
        showToast(`🎉 "${task.title}" verified! +৳ ${task.reward.toFixed(2)} added to database balance.`, 'success');
        refreshDatabaseData();
        return true;
      } else {
        const errorMsg = data.message || data.error || 'Task verification could not be confirmed.';
        showToast(errorMsg, 'error');
        return false;
      }
    } catch {
      showToast('Network error during task verification.', 'error');
      return false;
    }
  };

  // Updated Withdrawal Submission: Min 1500, dynamic fee
  const submitWithdrawal = async (
    method: PaymentMethod,
    accountNumber: string,
    amount: number
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanedNumber = accountNumber.trim();
    if (!cleanedNumber) {
      return { success: false, error: 'Please enter your account number.' };
    }
    if (!/^01\d{9}$/.test(cleanedNumber)) {
      return { 
        success: false, 
        error: 'Invalid Bangladesh mobile number. Must be 11 digits starting with 01 (e.g. 01712345678).' 
      };
    }
    if (amount < APP_CONFIG.minWithdrawalAmount) {
      return {
        success: false,
        error: `Minimum withdrawal amount is ৳ ${APP_CONFIG.minWithdrawalAmount.toFixed(0)}.`
      };
    }

    const res = await supabaseBackend.requestWithdrawal(user.uid, method, cleanedNumber, amount);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    setUser({ ...supabaseBackend.getCachedUser() });
    setWithdrawals(supabaseBackend.getUserWithdrawals());
    showToast(`✅ Withdrawal request of ৳ ${amount.toFixed(2)} submitted!`, 'success');
    return { success: true };
  };

  const resetToInitialState = () => {
    showToast('Reset action is disabled in production to preserve database integrity.', 'info');
  };

  const addDemoBalance = async (amount: number) => {
    const updated = await supabaseBackend.addDemoBalance(user.uid, user.telegramId, amount);
    setUser({ ...updated });
    showToast(`Added ৳ ${amount.toFixed(2)} balance to database.`, 'success');
  };

  useEffect(() => {
    fetch('/api/bot-info')
      .then((res) => res.json())
      .then((info) => {
        if (info && info.botUsername) {
          APP_CONFIG.setBotUsername(info.botUsername);
        } else if ((import.meta as any).env?.DEV && !APP_CONFIG.isBotConfigured()) {
          console.warn('[X BOOST Dev Notice] Please configure TELEGRAM_BOT_USERNAME in .env');
        }
      })
      .catch((err) => {
        if ((import.meta as any).env?.DEV) {
          console.warn('[X BOOST Config] Error retrieving bot-info:', err);
        }
      });
  }, []);

  const copyReferralLink = () => {
    const userReferralId = user.referralCode || user.telegramId || user.uid;
    const link = APP_CONFIG.getReferralLink(userReferralId);
    if (!link) {
      if ((import.meta as any).env?.DEV) {
        showToast('Developer notice: TELEGRAM_BOT_USERNAME is not configured in .env', 'error');
      } else {
        showToast('Referral link currently unavailable. Please try again shortly.', 'info');
      }
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        showToast('Referral link copied!', 'success');
      }).catch(() => {
        showToast('Referral link copied!', 'success');
      });
    } else {
      showToast('Referral link: ' + link, 'info');
    }
  };

  const shareReferralLink = () => {
    const userReferralId = user.referralCode || user.telegramId || user.uid;
    const link = APP_CONFIG.getReferralLink(userReferralId);
    if (!link) {
      copyReferralLink();
      return;
    }
    if (navigator.share) {
      navigator.share({
        title: 'X BOOST',
        text: `Join me on X BOOST and get ৳ ${APP_CONFIG.referralRewardAmount.toFixed(2)} welcome bonus!`,
        url: link
      }).catch(() => {
        copyReferralLink();
      });
    } else {
      setActiveModal('share');
    }
  };

  const simulateSingleReferral = async () => {
    const sampleNames = [
      'Tanvir Hasan', 'Nadia Islam', 'Karim Ullah', 'Sara Rahman',
      'Fatima Begum', 'Zubair Ahmed', 'Mehedi Hasan', 'Imran Khan'
    ];
    const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const randomTgId = String(Math.floor(100000000 + Math.random() * 900000000));
    
    const res = await supabaseBackend.processReferral(user.uid, {
      id: randomTgId,
      username: name.toLowerCase().replace(' ', '_'),
      name
    });

    if (res.success && res.newReferral && res.updatedUser) {
      setUser(res.updatedUser);
      setReferralsList((prev) => [res.newReferral!, ...prev]);
      const updatedLevel = calculateUserLevel(res.updatedUser.totalReferrals);
      showToast(
        `🎉 Database confirmed referral: ${res.newReferral.referredDisplayName}! Total: ${res.updatedUser.totalReferrals} (${updatedLevel.levelDisplay})`,
        'success'
      );
    } else {
      showToast(res.error || 'Failed to process referral in database.', 'error');
    }
  };

  const simulateMilestoneReferrals = async (targetCount: number) => {
    const needed = targetCount - user.totalReferrals;
    if (needed <= 0) {
      showToast(`Already at or above ${targetCount} referrals (current: ${user.totalReferrals}).`, 'info');
      return;
    }
    let added = 0;
    for (let i = 0; i < needed; i++) {
      const randomTgId = String(Math.floor(100000000 + Math.random() * 900000000));
      const res = await supabaseBackend.processReferral(user.uid, {
        id: randomTgId,
        username: `tg_user_${randomTgId.slice(-4)}`,
        name: `Referred Member ${user.totalReferrals + i + 1}`
      });
      if (res.success) added++;
    }
    await refreshDatabaseData();
    const lvl = calculateUserLevel(user.totalReferrals + added);
    showToast(
      `🎉 Added ${added} verified referrals to database! Upgraded to ${lvl.levelDisplay} (৳ ${lvl.dailyReward}/day)!`,
      'success'
    );
  };

  const testDuplicateReferral = async () => {
    const fixedTgId = '888999111';
    const firstRes = await supabaseBackend.processReferral(user.uid, {
      id: fixedTgId,
      username: 'duplicate_tester',
      name: 'Duplicate Tester'
    });

    if (!firstRes.success && !firstRes.error?.includes('Duplicate')) {
      showToast(`Database Guard: ${firstRes.error}`, 'error');
      return;
    }

    if (firstRes.success && firstRes.updatedUser) {
      setUser(firstRes.updatedUser);
      if (firstRes.newReferral) {
        setReferralsList((prev) => [firstRes.newReferral!, ...prev]);
      }
    }

    const secondRes = await supabaseBackend.processReferral(user.uid, {
      id: fixedTgId,
      username: 'duplicate_tester',
      name: 'Duplicate Tester'
    });

    if (!secondRes.success) {
      showToast(`🛡️ Unique Database Constraint Enforced: ${secondRes.error}`, 'info');
    }
  };

  const testSelfReferral = async () => {
    const res = await supabaseBackend.processReferral(user.uid, {
      id: user.telegramId || user.uid,
      username: user.username?.replace('@', '') || undefined,
      name: user.displayName
    });

    if (!res.success) {
      showToast(`🛡️ Self-Referral Database Guard Enforced: ${res.error}`, 'info');
    }
  };

  const testDoubleDailyClaim = async () => {
    const res = await supabaseBackend.claimDailyReward(user.uid, user.telegramId);
    if (!res.success) {
      showToast(`🛡️ Daily Bonus Unique Guard Enforced: ${res.error}`, 'info');
    } else {
      if (res.user) setUser(res.user);
      showToast(`Claimed ৳ ${res.claimedReward} daily bonus. Now try claiming again!`, 'success');
    }
  };

  const referralTiers: ReferralTierData[] = [
    {
      level: 1,
      name: '1st Level',
      commissionLabel: 'Direct Referrals (5% Commission)',
      usersCount: user.totalReferrals,
      earnedAmount: +(user.totalReferrals * (APP_CONFIG.referralRewardAmount * 0.05)).toFixed(2)
    },
    {
      level: 2,
      name: '2nd Level',
      commissionLabel: 'Sub-Referrals (3% Commission)',
      usersCount: 0,
      earnedAmount: 0.00
    },
    {
      level: 3,
      name: '3rd Level',
      commissionLabel: 'Network Referrals (2% Commission)',
      usersCount: 0,
      earnedAmount: 0.00
    }
  ];

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        user,
        levelDetails,
        tasks,
        withdrawals,
        leaderboard: supabaseBackend.getLeaderboard(),
        referralTiers,
        referralsList,
        toasts,
        verificationStatus,
        verificationError,
        reverifyTelegramAccount,
        showToast,
        claimDailyBonus,
        startWatchingAd,
        isWatchingAd,
        closeAdModal,
        watchSession,
        refreshAdSession,
        completeAdStep,
        claimAdReward,
        isClaimingReward,
        joinTask,
        closeTaskModal,
        activeVerifyingTaskId,
        verifyTask,
        submitWithdrawal,
        resetToInitialState,
        addDemoBalance,
        copyReferralLink,
        shareReferralLink,
        activeModal,
        setActiveModal,
        simulateSingleReferral,
        simulateMilestoneReferrals,
        testDuplicateReferral,
        testSelfReferral,
        testDoubleDailyClaim
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
