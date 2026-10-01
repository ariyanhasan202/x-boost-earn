import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../config/appConfig';
import { UserProfile, ReferralRecord, WithdrawalTransaction, LeaderboardUser } from '../types';
import { calculateUserLevel } from './levelSystem';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_ANON_KEY.includes('your-anon-key')
);

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function generateUniqueCode(seed?: string): string {
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0');
    return hex.slice(0, 6);
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';

const INITIAL_USER_ROW: UserProfile = {
  uid: DEFAULT_USER_ID,
  telegramId: '',
  username: null,
  displayName: 'Guest (Unverified)',
  firstName: null,
  lastName: null,
  photoUrl: null,
  isVerified: false,
  verifiedAt: null,
  referralCode: generateUniqueCode(),
  referredBy: null,
  totalReferrals: 0,
  level: 0,
  dailyReward: 5,
  balance: 0.00,
  totalEarned: 0.00,
  totalWithdrawn: 0.00,
  tasksCompleted: 0,
  dailyAdsWatched: 0,
  dailyAdsLimit: APP_CONFIG.maxDailyAds,
  dailyBonusClaimedToday: false,
  lastDailyBonusDate: null,
  createdAt: '2026-09-01T00:00:00.000Z'
};

const BENCHMARK_LEADERBOARD: LeaderboardUser[] = [
  { rank: 1, name: 'ASIF CHOWDHURY', referrals: 12343, isCustomIcon: true },
  { rank: 2, name: 'Nill Pori', referrals: 5588, avatarText: 'ON', avatarColor: '#0a192f' },
  { rank: 3, name: 'Ordinary', referrals: 1598, avatarText: 'ORD', avatarColor: '#0284c7' },
  { rank: 4, name: 'A1', referrals: 610, avatarText: 'A1M', avatarColor: '#0f172a' },
  { rank: 5, name: 'Foysal', referrals: 510, avatarText: 'FF', avatarColor: '#06b6d4' },
  { rank: 6, name: 'DRAVO', referrals: 446, avatarText: 'DRV', avatarColor: '#e11d48' }
];

class SupabaseBackendService {
  private cachedUser: UserProfile = { ...INITIAL_USER_ROW };
  private cachedReferrals: ReferralRecord[] = [];
  private withdrawalsList: WithdrawalTransaction[] = [];

  // Transform raw API/database row to typed UserProfile
  public parseUserProfile(raw: any): UserProfile {
    if (!raw) return { ...INITIAL_USER_ROW };
    const uid = raw.id || raw.uid || (raw.telegram_id ? `tg_${raw.telegram_id}` : DEFAULT_USER_ID);
    const tgId = String(raw.telegram_id || raw.telegramId || '').trim();
    const totalRefs = Number(raw.total_referrals ?? raw.totalReferrals ?? 0);
    const lvl = calculateUserLevel(totalRefs);
    const firstName = raw.first_name || raw.firstName || null;
    const lastName = raw.last_name || raw.lastName || null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const displayName = fullName || raw.display_name || raw.displayName || (raw.username ? `@${raw.username}` : 'User');
    const rawUsername = raw.username ?? null;
    const formattedUsername = rawUsername ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`) : null;
    const today = new Date().toISOString().split('T')[0];
    const lastBonusDate = raw.last_daily_bonus_date || raw.lastDailyBonusDate || null;
    const dailyBonusClaimedToday = raw.daily_bonus_claimed_today ?? (lastBonusDate === today);

    return {
      uid,
      telegramId: tgId,
      username: formattedUsername,
      displayName,
      firstName,
      lastName,
      photoUrl: raw.photo_url || raw.photoUrl || null,
      isVerified: Boolean(raw.is_verified || raw.isVerified || raw.telegram_verified || tgId),
      verifiedAt: raw.verified_at || raw.verifiedAt || new Date().toISOString(),
      referralCode: raw.referral_code || raw.referralCode || generateUniqueCode(tgId || uid),
      referredBy: raw.referrer_id || raw.referredBy || null,
      totalReferrals: totalRefs,
      level: lvl.level,
      dailyReward: lvl.dailyReward,
      balance: +(Number(raw.balance || 0)).toFixed(2),
      totalEarned: +(Number(raw.total_earned ?? raw.totalEarned ?? 0)).toFixed(2),
      totalWithdrawn: +(Number(raw.total_withdrawn ?? raw.totalWithdrawn ?? 0)).toFixed(2),
      tasksCompleted: Number(raw.tasks_completed ?? raw.tasksCompleted ?? 0),
      dailyAdsWatched: Number(raw.daily_ads_watched ?? raw.dailyAdsWatched ?? 0),
      dailyAdsLimit: APP_CONFIG.maxDailyAds,
      dailyBonusClaimedToday,
      lastDailyBonusDate: lastBonusDate,
      createdAt: raw.created_at || raw.createdAt || new Date().toISOString()
    };
  }

  public getCachedUser(): UserProfile {
    return this.cachedUser;
  }

  public setCachedUser(user: UserProfile) {
    this.cachedUser = user;
  }

  // Authoritative Database Fetch: Load User from API/Supabase
  public async fetchAuthoritativeUser(userId?: string, telegramId?: string): Promise<UserProfile | null> {
    const idParam = userId || this.cachedUser.uid;
    const tgParam = telegramId || this.cachedUser.telegramId;
    try {
      let url = '/api/user/profile?';
      if (idParam && idParam !== DEFAULT_USER_ID) {
        url += `userId=${encodeURIComponent(idParam)}&`;
      }
      if (tgParam) {
        url += `telegramId=${encodeURIComponent(tgParam)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.profile) {
          const parsed = this.parseUserProfile(json.profile);
          this.cachedUser = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error fetching authoritative user from database:', err);
    }
    return null;
  }

  // Authoritative Database Fetch: Load Referrals from API/Supabase
  public async fetchAuthoritativeReferrals(userId?: string, telegramId?: string): Promise<ReferralRecord[]> {
    const idParam = userId || this.cachedUser.uid;
    const tgParam = telegramId || this.cachedUser.telegramId;
    try {
      let url = '/api/referrals?';
      if (idParam && idParam !== DEFAULT_USER_ID) {
        url += `userId=${encodeURIComponent(idParam)}&`;
      }
      if (tgParam) {
        url += `telegramId=${encodeURIComponent(tgParam)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.referrals)) {
          this.cachedReferrals = json.referrals;
          return json.referrals;
        }
      }
    } catch (err) {
      console.warn('Error fetching authoritative referrals:', err);
    }
    return this.cachedReferrals;
  }

  // Authoritative Database Fetch: Load Withdrawals from API/Supabase
  public async fetchAuthoritativeWithdrawals(userId?: string, telegramId?: string): Promise<WithdrawalTransaction[]> {
    const idParam = userId || this.cachedUser.uid;
    const tgParam = telegramId || this.cachedUser.telegramId;
    try {
      let url = '/api/withdrawals?';
      if (idParam && idParam !== DEFAULT_USER_ID) {
        url += `userId=${encodeURIComponent(idParam)}&`;
      }
      if (tgParam) {
        url += `telegramId=${encodeURIComponent(tgParam)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.withdrawals)) {
          this.withdrawalsList = json.withdrawals.map((w: any) => ({
            id: w.id,
            userId: w.user_id || w.userId,
            telegramId: w.telegram_id || w.telegramId,
            method: w.method,
            accountNumber: w.account_number || w.accountNumber,
            amount: Number(w.amount) || 0,
            charge: Number(w.charge) || 0,
            totalCharge: Number(w.charge) || 0,
            receiveAmount: Number(w.receive_amount || w.receiveAmount) || 0,
            status: w.status,
            telegramMessageId: w.telegram_message_id || w.telegramMessageId || null,
            telegramGroupId: w.telegram_group_id || w.telegramGroupId || null,
            createdAt: w.created_at_formatted || w.created_at || w.createdAt
          }));
          return this.withdrawalsList;
        }
      }
    } catch (err) {
      console.warn('Error fetching authoritative withdrawals:', err);
    }
    return this.withdrawalsList;
  }

  // Authoritative Database Update: Claim Daily Bonus
  public async claimDailyReward(userId: string, telegramId?: string): Promise<{
    success: boolean;
    error?: string;
    claimedReward?: number;
    newBalance?: number;
    user?: UserProfile;
  }> {
    try {
      const res = await fetch('/api/daily-bonus/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, telegramId })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.user) {
          const parsed = this.parseUserProfile(json.user);
          this.cachedUser = parsed;
          return {
            success: true,
            claimedReward: json.claimedReward,
            newBalance: json.newBalance,
            user: parsed
          };
        }
        this.cachedUser.balance = json.newBalance;
        this.cachedUser.dailyBonusClaimedToday = true;
        return {
          success: true,
          claimedReward: json.claimedReward,
          newBalance: json.newBalance,
          user: this.cachedUser
        };
      }
      return { success: false, error: json.error || 'Failed to claim daily reward' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error claiming daily bonus' };
    }
  }

  // Authoritative Database Update: Process Referral
  public async processReferral(
    referrerUid: string,
    referredTelegramUser: { id: string; username?: string; name: string }
  ): Promise<{
      success: boolean;
      error?: string;
      updatedUser?: UserProfile;
      newReferral?: ReferralRecord;
    }> {
    try {
      const res = await fetch('/api/referrals/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerId: referrerUid,
          referrerCode: this.cachedUser.referralCode,
          telegramId: this.cachedUser.telegramId,
          referredTelegramUser
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        let updatedProfile = this.cachedUser;
        if (json.updatedReferrer) {
          updatedProfile = this.parseUserProfile(json.updatedReferrer);
          this.cachedUser = updatedProfile;
        }
        if (json.newReferral) {
          this.cachedReferrals.unshift(json.newReferral);
        }
        return {
          success: true,
          updatedUser: updatedProfile,
          newReferral: json.newReferral
        };
      }
      return { success: false, error: json.error || 'Referral processing rejected' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error processing referral' };
    }
  }

  // Authoritative Database Update: Add Demo Balance
  public async addDemoBalance(userId: string, telegramId: string, amount: number): Promise<UserProfile> {
    try {
      const res = await fetch('/api/balance/add-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, telegramId, amount })
      });
      const json = await res.json();
      if (res.ok && json.success && json.newBalance !== undefined) {
        this.cachedUser.balance = json.newBalance;
        this.cachedUser.totalEarned = json.totalEarned;
      }
    } catch {
      this.cachedUser.balance = +(this.cachedUser.balance + amount).toFixed(2);
      this.cachedUser.totalEarned = +(this.cachedUser.totalEarned + amount).toFixed(2);
    }
    return this.cachedUser;
  }

  // Updated Withdrawal System: Minimum 1500, Charge = (Amount / 500) * 100
  // Sends request to server, stores in DB, sends Telegram notification with message_id saved
  public async requestWithdrawal(
    uid: string,
    method: 'bkash' | 'nagad',
    accountNumber: string,
    amount: number
  ): Promise<{ success: boolean; error?: string; transaction?: WithdrawalTransaction }> {
    if (amount < APP_CONFIG.minWithdrawalAmount) {
      return {
        success: false,
        error: `Minimum withdrawal amount is ${APP_CONFIG.minWithdrawalAmount.toFixed(0)}.`
      };
    }
    if (this.cachedUser.balance < amount) {
      return {
        success: false,
        error: `Insufficient balance! You have ${this.cachedUser.balance.toFixed(2)}, but requested ${amount.toFixed(2)}.`
      };
    }

    try {
      const res = await fetch('/api/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid || this.cachedUser.uid,
          telegramId: this.cachedUser.telegramId,
          userName: this.cachedUser.displayName,
          method,
          accountNumber,
          amount
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.withdrawal) {
        const w = data.withdrawal;
        const tx: WithdrawalTransaction = {
          id: w.id,
          userId: w.user_id,
          telegramId: w.telegram_id,
          method: w.method,
          accountNumber: w.account_number,
          amount: Number(w.amount),
          charge: Number(w.charge),
          totalCharge: Number(w.charge),
          receiveAmount: Number(w.receive_amount),
          status: w.status,
          telegramMessageId: w.telegram_message_id,
          telegramGroupId: w.telegram_group_id,
          createdAt: w.created_at_formatted || w.dhaka_time || w.created_at
        };

        this.withdrawalsList.unshift(tx);
        if (data.newBalance !== undefined) {
          this.cachedUser.balance = data.newBalance;
          this.cachedUser.totalWithdrawn = data.totalWithdrawn;
        } else {
          this.cachedUser.balance = +(this.cachedUser.balance - amount).toFixed(2);
          this.cachedUser.totalWithdrawn = +(this.cachedUser.totalWithdrawn + tx.receiveAmount).toFixed(2);
        }
        return { success: true, transaction: tx };
      }

      return {
        success: false,
        error: data.error || data.message || 'Failed to submit withdrawal request.'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error submitting withdrawal request.'
      };
    }
  }

  public getUserReferrals(): ReferralRecord[] {
    return this.cachedReferrals;
  }

  public getUserWithdrawals(): WithdrawalTransaction[] {
    return this.withdrawalsList;
  }

  public getLeaderboard(): LeaderboardUser[] {
    const dynamicUsers = [
      {
        name: this.cachedUser.displayName,
        referrals: this.cachedUser.totalReferrals,
        avatarText: this.cachedUser.displayName.slice(0, 2).toUpperCase(),
        avatarColor: '#7c25d3'
      }
    ];

    const combined = [...BENCHMARK_LEADERBOARD, ...dynamicUsers];
    combined.sort((a, b) => b.referrals - a.referrals);
    return combined.slice(0, 20).map((u, i) => ({
      ...u,
      rank: i + 1
    }));
  }
}

export const supabaseBackend = new SupabaseBackendService();
