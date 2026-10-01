import { UserLevel } from '../services/levelSystem';

export type NavTab = 'home' | 'earn' | 'refer' | 'withdraw' | 'profile';

export type PaymentMethod = 'bkash' | 'nagad';

export interface UserProfile {
  uid: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  isVerified: boolean;
  verifiedAt?: string | null;
  referralCode: string;
  referredBy: string | null;
  totalReferrals: number;
  level: UserLevel;
  dailyReward: number;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  tasksCompleted: number;
  dailyAdsWatched: number;
  dailyAdsLimit: number;
  dailyBonusClaimedToday: boolean;
  lastDailyBonusDate: string | null;
  createdAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  referredUid: string;
  referredTelegramId: string;
  referredDisplayName: string;
  createdAt: string;
  status: 'confirmed';
}

export interface DailyClaimRecord {
  id: string;
  uid: string;
  date: string;
  claimedReward: number;
  levelAtClaim: UserLevel;
  claimedAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  reward: number;
  categoryBadge: string;
  iconType: 'gift' | 'telegram' | 'other';
  channelUrl: string;
  status: 'pending' | 'verifying' | 'completed';
}

export interface WithdrawalTransaction {
  id: string;
  userId?: string;
  telegramId?: string;
  method: PaymentMethod;
  accountNumber: string;
  amount: number;
  charge: number;
  referralCharge?: number;
  vatCharge?: number;
  totalCharge: number;
  receiveAmount: number;
  status: 'Pending' | 'Complete' | 'Next Day' | 'Rejected' | string;
  telegramMessageId?: number | null;
  telegramGroupId?: string | number | null;
  createdAt: string;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  referrals: number;
  avatarText?: string;
  avatarColor?: string;
  isCustomIcon?: boolean;
}

export interface ReferralTierData {
  level: number;
  name: string;
  commissionLabel: string;
  usersCount: number;
  earnedAmount: number;
}
