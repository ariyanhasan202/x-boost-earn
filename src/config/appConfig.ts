export function sanitizeBotUsername(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@+/, '')
    .trim();
}

// Read from Vite environment variable with clean sanitization
const envBotUsername = sanitizeBotUsername(
  (import.meta as any).env?.VITE_TELEGRAM_BOT_USERNAME ||
  (import.meta as any).env?.TELEGRAM_BOT_USERNAME ||
  ''
);

let runtimeBotUsername = envBotUsername || 'xboost_earn_bot';

export const APP_CONFIG = {
  appName: 'X BOOST',
  get botUsername(): string {
    return runtimeBotUsername;
  },
  setBotUsername(username: string) {
    const cleaned = sanitizeBotUsername(username);
    if (cleaned) {
      runtimeBotUsername = cleaned;
    }
  },
  isBotConfigured(): boolean {
    return Boolean(runtimeBotUsername);
  },
  officialChannelUrl: 'https://t.me/xboost_comionitiy',
  officialChannelUsername: 'xboost_comionitiy',
  referralRewardAmount: 50.00,
  dailyAdRewardAmount: 2.00,
  minWithdrawalAmount: 1500.00,
  maxDailyAds: 300,
  
  // Withdrawal Charge: Every 500 withdrawal amount = 100 charge
  // Formula: Charge = Withdrawal Amount / 500 * 100
  calculateWithdrawalCharge: (amount: number): number => {
    if (amount <= 0) return 0;
    return +((amount / 500) * 100).toFixed(2);
  },

  calculateUserPayout: (amount: number): number => {
    if (amount <= 0) return 0;
    const charge = (amount / 500) * 100;
    return Math.max(0, +(amount - charge).toFixed(2));
  },

  // Unique referral URL generated with the authenticated user's unique referral ID
  // Expected format: https://t.me/{TELEGRAM_BOT_USERNAME}?start={USER_REFERRAL_ID}
  getReferralLink: (userReferralId: string): string => {
    const cleanBot = sanitizeBotUsername(runtimeBotUsername);
    if (!cleanBot) {
      return '';
    }
    const cleanId = (userReferralId || '').trim();
    return `https://t.me/${cleanBot}?start=${cleanId}`;
  }
};
