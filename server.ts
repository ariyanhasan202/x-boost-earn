import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Server-side Secrets & Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export function cleanBotUsername(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@+/, '')
    .trim();
}

const rawBotUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME || 'xboost_earn_bot';
const TELEGRAM_BOT_USERNAME = cleanBotUsername(rawBotUsername);
const TELEGRAM_WEBAPP_URL = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || '';

// Telegram Group IDs
const TELEGRAM_WITHDRAW_GROUP_ID = process.env.TELEGRAM_WITHDRAW_GROUP_ID || process.env.TELEGRAM_ADMIN_GROUP_ID || '';
const TELEGRAM_NEW_USER_GROUP_ID = process.env.TELEGRAM_NEW_USER_GROUP_ID || TELEGRAM_WITHDRAW_GROUP_ID || '';
const TELEGRAM_ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Timezone Helper: Format Date & Time in GMT+6 (Asia/Dhaka)
// Format requirement: "02 Oct 2026, 01:25 AM"
export function formatDhakaDateTime(date: Date = new Date()): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
    return formatted
      .replace(/[\u202F\u00A0]/g, ' ')
      .replace(/\bam\b/i, 'AM')
      .replace(/\bpm\b/i, 'PM');
  } catch {
    return date.toISOString();
  }
}

// Supabase Client Setup
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let serverSupabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_URL.includes('your-project') && !SUPABASE_SERVICE_ROLE_KEY.includes('your-secret')) {
  try {
    serverSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    console.log('[Supabase Server] Connected to Supabase:', SUPABASE_URL);
  } catch (err: any) {
    console.warn('[Supabase Server Init Warning]:', err.message);
  }
}

// -------------------------------------------------------------
// Persistent Server Database Store (Persistent Shadow / Fallback)
// -------------------------------------------------------------
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FOLDER = path.join(DATA_DIR, 'supabase_store');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STORE_FOLDER)) {
  fs.mkdirSync(STORE_FOLDER, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'supabase_store.json');
const DB_FILE_IN_FOLDER = path.join(STORE_FOLDER, 'supabase_store.json');

export interface DbUser {
  id: string;
  telegram_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  referrer_id: string | null;
  referral_code: string;
  balance: number;
  total_referrals: number;
  level: number;
  total_earned: number;
  total_withdrawn: number;
  tasks_completed: number;
  completed_tasks: string[];
  daily_ads_watched: number;
  last_daily_bonus_date: string | null;
  first_started_at?: string | null;
  new_user_notified?: boolean;
  created_at: string;
}

export interface DbReferral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referred_telegram_id: string;
  referred_display_name: string;
  status: string;
  reward_amount: number;
  created_at: string;
}

export interface DbWithdrawal {
  id: string;
  user_id: string;
  telegram_id: string;
  user_name: string;
  method: 'bkash' | 'nagad';
  account_number: string;
  amount: number;
  charge: number;
  receive_amount: number;
  status: string; // 'Pending' | 'Complete' | 'Next Day' | 'Rejected'
  telegram_message_id: number | null;
  telegram_group_id: string | number | null;
  created_at: string;
  dhaka_time: string;
}

interface PersistentStore {
  users: Record<string, DbUser>; // keyed by user id
  referrals: DbReferral[];
  withdrawals: DbWithdrawal[];
}

function loadPersistentStore(): PersistentStore {
  try {
    let targetPath = DB_FILE;
    if (!fs.existsSync(targetPath) && fs.existsSync(DB_FILE_IN_FOLDER)) {
      targetPath = DB_FILE_IN_FOLDER;
    }
    if (fs.existsSync(targetPath)) {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        users: parsed.users || {},
        referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
        withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : []
      };
    }
  } catch (err) {
    console.error('Error reading persistent store:', err);
  }
  return { users: {}, referrals: [], withdrawals: [] };
}

let memoryStore = loadPersistentStore();

function savePersistentStore() {
  try {
    const jsonStr = JSON.stringify(memoryStore, null, 2);
    // Write primary store file
    fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');

    // Ensure folder exists and sync copies to data/supabase_store folder
    if (!fs.existsSync(STORE_FOLDER)) {
      fs.mkdirSync(STORE_FOLDER, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_IN_FOLDER, jsonStr, 'utf-8');
    fs.writeFileSync(path.join(STORE_FOLDER, 'users.json'), JSON.stringify(memoryStore.users, null, 2), 'utf-8');
    fs.writeFileSync(path.join(STORE_FOLDER, 'withdrawals.json'), JSON.stringify(memoryStore.withdrawals, null, 2), 'utf-8');
    fs.writeFileSync(path.join(STORE_FOLDER, 'referrals.json'), JSON.stringify(memoryStore.referrals, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving persistent store:', err);
  }
}

// Helper: Find user in persistent store by id, telegram_id, or referral_code
function findLocalUser(identifier: string): DbUser | null {
  if (!identifier) return null;
  const cleanId = String(identifier).trim();
  if (memoryStore.users[cleanId]) {
    return memoryStore.users[cleanId];
  }
  for (const u of Object.values(memoryStore.users)) {
    if (String(u.telegram_id) === cleanId || u.id === cleanId || u.referral_code === cleanId.toUpperCase()) {
      return u;
    }
  }
  return null;
}

function saveLocalUser(user: DbUser) {
  memoryStore.users[user.id] = user;
  savePersistentStore();
}

app.use(express.json());

// -------------------------------------------------------------
// Registered Telegram Tasks
// -------------------------------------------------------------
export interface RegisteredTask {
  id: string;
  title: string;
  channelUsername: string;
  channelUrl: string;
  reward: number;
  categoryBadge: string;
  iconType: 'gift' | 'telegram' | 'other';
  description: string;
}

export const REGISTERED_TASKS: Record<string, RegisteredTask> = {
  'task-1': {
    id: 'task-1',
    title: 'Welcome Bonus',
    channelUsername: 'colour_trading_leder_admin_group',
    channelUrl: 'https://t.me/colour_trading_leder_admin_group',
    reward: 50.00,
    categoryBadge: 'JOIN BONUS',
    iconType: 'gift',
    description: 'Join our official leader & admin group'
  },
  'task-2': {
    id: 'task-2',
    title: 'Payment Channel',
    channelUsername: 'x_bost_incoming',
    channelUrl: 'https://t.me/x_bost_incoming',
    reward: 20.00,
    categoryBadge: 'TELEGRAM',
    iconType: 'telegram',
    description: 'Subscribe to our payment proof channel'
  },
  'task-3': {
    id: 'task-3',
    title: 'Giveaway',
    channelUsername: 'devloper_solution_bd',
    channelUrl: 'https://t.me/devloper_solution_bd',
    reward: 20.00,
    categoryBadge: 'OTHER',
    iconType: 'other',
    description: 'Join developer giveaway & special perks'
  },
  'task-4': {
    id: 'task-4',
    title: 'Official Channel',
    channelUsername: 'xboost_comionitiy',
    channelUrl: 'https://t.me/xboost_comionitiy',
    reward: 20.00,
    categoryBadge: 'TELEGRAM',
    iconType: 'telegram',
    description: 'Follow our official X BOOST community channel'
  }
};

const taskOpenTimestamps = new Map<string, number>(); // `${userId}_${taskId}` -> timestamp
const taskVerificationLocks = new Set<string>(); // `${userId}_${taskId}` lock

// -------------------------------------------------------------
// Watch Sessions (Authoritative 3-Step Rewarded Ad Tracking)
// -------------------------------------------------------------
interface WatchSession {
  sessionId: string;
  userId: string;
  completedCount: number;
  totalRequired: number;
  rewardEligible: boolean;
  rewardClaimed: boolean;
  rewardAmount: number;
  stepTimestamps: number[];
  createdAt: number;
  updatedAt: number;
  claimedAt?: number;
}

const activeWatchSessions = new Map<string, WatchSession>();
const userCurrentSession = new Map<string, string>(); // userId -> sessionId
const claimInProgressLocks = new Set<string>();
const processedUpdateIds = new Set<number>();

// Cleanup timer
setInterval(() => {
  if (processedUpdateIds.size > 10000) {
    processedUpdateIds.clear();
  }
  const now = Date.now();
  for (const [sId, sess] of activeWatchSessions.entries()) {
    if (now - sess.createdAt > 2 * 60 * 60 * 1000) {
      activeWatchSessions.delete(sId);
      if (userCurrentSession.get(sess.userId) === sId) {
        userCurrentSession.delete(sess.userId);
      }
    }
  }
  for (const [key, time] of taskOpenTimestamps.entries()) {
    if (now - time > 60 * 60 * 1000) {
      taskOpenTimestamps.delete(key);
    }
  }
}, 30 * 60 * 1000);

export function calculateTierLevel(totalRefs: number): number {
  if (totalRefs >= 300) return 6; // VIP
  if (totalRefs >= 240) return 5;
  if (totalRefs >= 180) return 4;
  if (totalRefs >= 120) return 3;
  if (totalRefs >= 80) return 2;
  if (totalRefs >= 40) return 1;
  return 0;
}

export function calculateDailyReward(level: number): number {
  switch (level) {
    case 6: return 80;
    case 5: return 50;
    case 4: return 40;
    case 3: return 30;
    case 2: return 20;
    case 1: return 10;
    default: return 5;
  }
}

export function validateTelegramWebAppData(initData: string, botToken: string): {
  isValid: boolean;
  user?: {
    id: string;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  start_param?: string;
  auth_date?: number;
  error?: string;
} {
  if (!botToken) {
    return { isValid: false, error: 'TELEGRAM_BOT_TOKEN is not configured on server' };
  }
  try {
    let cleanInitData = initData.trim();
    if (cleanInitData.startsWith('#')) {
      cleanInitData = cleanInitData.slice(1);
    }
    if (cleanInitData.includes('tgWebAppData=')) {
      const match = cleanInitData.match(/tgWebAppData=([^&]+)/);
      if (match) {
        cleanInitData = decodeURIComponent(match[1]);
      }
    }
    const urlParams = new URLSearchParams(cleanInitData);
    const hash = urlParams.get('hash');
    if (!hash) {
      return { isValid: false, error: 'Missing hash parameter in Telegram initData' };
    }
    urlParams.delete('hash');
    const params: string[] = [];
    for (const [key, value] of urlParams.entries()) {
      params.push(`${key}=${value}`);
    }
    params.sort();
    const dataCheckString = params.join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      return { isValid: false, error: 'Invalid Telegram WebApp HMAC signature' };
    }
    const userRaw = urlParams.get('user');
    let user;
    if (userRaw) {
      const parsed = JSON.parse(userRaw);
      user = {
        id: String(parsed.id),
        first_name: parsed.first_name || '',
        last_name: parsed.last_name || '',
        username: parsed.username || '',
        language_code: parsed.language_code || '',
        photo_url: parsed.photo_url || ''
      };
    }
    const authDate = Number(urlParams.get('auth_date')) || undefined;
    return {
      isValid: true,
      user,
      start_param: urlParams.get('start_param') || undefined,
      auth_date: authDate
    };
  } catch (err: any) {
    return { isValid: false, error: err.message || 'Error validating initData' };
  }
}

async function getTelegramUserProfilePhoto(userId: string | number, botToken: string): Promise<string | null> {
  if (!botToken || !userId) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const photosRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!photosRes.ok) return null;
    const photosData = await photosRes.json();
    if (!photosData.ok || !photosData.result || photosData.result.total_count === 0 || !photosData.result.photos?.[0]?.length) {
      return null;
    }
    const photoSizes = photosData.result.photos[0];
    const selectedPhoto = photoSizes[photoSizes.length - 1];
    const fileId = selectedPhoto.file_id;
    const fileController = new AbortController();
    const fileTimeout = setTimeout(() => fileController.abort(), 1800);
    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      { signal: fileController.signal }
    );
    clearTimeout(fileTimeout);
    if (!fileRes.ok) return null;
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;
    return `/api/telegram-avatar/${userId}?path=${encodeURIComponent(fileData.result.file_path)}`;
  } catch (err) {
    console.warn('[Telegram Avatar Helper]:', err);
    return null;
  }
}

// -------------------------------------------------------------
// Helper: Send Message to Telegram Group / Chat
// -------------------------------------------------------------
export async function sendTelegramApiMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: any
): Promise<{ ok: boolean; result?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram Notification]: Bot token not configured, skipping send.');
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  if (!chatId) {
    console.warn('[Telegram Notification]: Target chatId/groupId not configured, skipping send.');
    return { ok: false, error: 'Target chat ID not configured' };
  }
  try {
    const bodyPayload: any = {
      chat_id: chatId,
      text: text
    };
    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('[Telegram Send Warning]:', data.description || 'Failed to send message');
      return { ok: false, error: data.description };
    }
    return { ok: true, result: data.result };
  } catch (err: any) {
    console.error('[Telegram Send Error]:', err.message);
    return { ok: false, error: err.message };
  }
}

// -------------------------------------------------------------
// 1. Withdrawal Notification to Telegram Group
// Format:
// Withdraw Request
//
// Name : [Telegram Full Name]
// Method : [bKash / Nagad / selected withdrawal method]
// Pay Out : [User-এর withdrawal number/account]
// Time : [GMT+6 অনুযায়ী Date + Time]
// Status : Pending
// -------------------------------------------------------------
export async function sendWithdrawalNotificationToGroup(
  withdrawal: DbWithdrawal
): Promise<{ ok: boolean; messageId?: number }> {
  const targetGroup = withdrawal.telegram_group_id || TELEGRAM_WITHDRAW_GROUP_ID;
  if (!targetGroup) {
    console.warn('[Withdrawal Notification]: No target group configured (TELEGRAM_WITHDRAW_GROUP_ID).');
    return { ok: false };
  }

  // Prevent duplicate Telegram message for the same withdrawal
  if (withdrawal.telegram_message_id) {
    console.log(`[Withdrawal Notification]: Withdrawal ${withdrawal.id} already has telegram_message_id=${withdrawal.telegram_message_id}. Skipping duplicate send.`);
    return { ok: true, messageId: withdrawal.telegram_message_id };
  }

  const messageText = 
`Withdraw Request

Name : ${withdrawal.user_name || 'User'}
Method : ${withdrawal.method === 'bkash' ? 'bKash' : 'Nagad'}
Pay Out : ${withdrawal.account_number}
Time : ${withdrawal.dhaka_time}
Status : ${withdrawal.status || 'Pending'}`;

  const sendRes = await sendTelegramApiMessage(targetGroup, messageText);
  if (sendRes.ok && sendRes.result?.message_id) {
    withdrawal.telegram_message_id = sendRes.result.message_id;
    withdrawal.telegram_group_id = targetGroup;
    savePersistentStore();
    return { ok: true, messageId: sendRes.result.message_id };
  }
  return { ok: false };
}

// -------------------------------------------------------------
// 3. New User Notification to Telegram Group (ONLY ONCE)
// Format:
// New User
//
// Name : [Telegram Full Name]
// Chat ID : [Telegram Chat ID]
// Referral : [Referral Chat ID / Referral Code / None]
// Joined : [GMT+6 Date + Time]
// -------------------------------------------------------------
export async function sendNewUserNotificationToGroup(userData: {
  name: string;
  chatId: string | number;
  referral?: string | null;
  joinedTime?: string;
}): Promise<{ ok: boolean }> {
  const targetGroup = TELEGRAM_NEW_USER_GROUP_ID || TELEGRAM_WITHDRAW_GROUP_ID;
  if (!targetGroup) {
    console.warn('[New User Notification]: No target group configured (TELEGRAM_NEW_USER_GROUP_ID).');
    return { ok: false };
  }

  const referralDisplay = userData.referral && userData.referral.trim() ? userData.referral.trim() : 'None';
  const timeDisplay = userData.joinedTime || formatDhakaDateTime(new Date());

  const messageText = 
`New User

Name : ${userData.name}
Chat ID : ${userData.chatId}
Referral : ${referralDisplay}
Joined : ${timeDisplay}`;

  const sendRes = await sendTelegramApiMessage(targetGroup, messageText);
  return { ok: sendRes.ok };
}

app.get('/api/bot-info', (_req: Request, res: Response) => {
  res.json({
    configured: Boolean(TELEGRAM_BOT_USERNAME),
    hasBotToken: Boolean(TELEGRAM_BOT_TOKEN),
    botUsername: TELEGRAM_BOT_USERNAME,
    webAppUrl: TELEGRAM_WEBAPP_URL,
    officialChannelUrl: 'https://t.me/xboost_comionitiy',
    hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasWithdrawGroup: Boolean(TELEGRAM_WITHDRAW_GROUP_ID),
    hasNewUserGroup: Boolean(TELEGRAM_NEW_USER_GROUP_ID)
  });
});

// -------------------------------------------------------------
// Dedicated Download & Export Handlers for data/supabase_store
// Resolves any "failed to download" error when exporting or downloading data/supabase_store
// -------------------------------------------------------------
const serveStoreDownload = (_req: Request, res: Response) => {
  try {
    const rawData = JSON.stringify(memoryStore, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="supabase_store.json"');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(rawData);
  } catch (err: any) {
    return res.status(500).json({ error: 'Download failed', message: err.message });
  }
};

app.get('/data/supabase_store', serveStoreDownload);
app.get('/data/supabase_store.json', serveStoreDownload);
app.get('/api/download/supabase_store', serveStoreDownload);
app.get('/api/export/supabase_store', serveStoreDownload);
app.get('/api/data/supabase_store', serveStoreDownload);
app.get('/api/data/supabase_store.json', serveStoreDownload);

// Serve individual files inside data/supabase_store folder
app.get('/data/supabase_store/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const targetFilePath = path.join(STORE_FOLDER, safeFilename);

  if (fs.existsSync(targetFilePath)) {
    if (safeFilename.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.sendFile(targetFilePath);
  }

  // Fallback: If requesting supabase_store.json and not inside folder, check data dir
  const fallbackPath = path.join(DATA_DIR, safeFilename);
  if (fs.existsSync(fallbackPath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.sendFile(fallbackPath);
  }

  return res.status(404).json({ error: 'File not found' });
});

app.get('/api/telegram-avatar/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const filePathParam = req.query.path as string;
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).send('Telegram Bot Token not configured on server');
  }
  try {
    let filePath = filePathParam;
    if (!filePath) {
      const photosRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
      const photosData = await photosRes.json();
      if (!photosData.ok || !photosData.result?.photos?.[0]?.length) {
        return res.status(404).send('No profile photo found');
      }
      const photoSizes = photosData.result.photos[0];
      const fileId = photoSizes[photoSizes.length - 1].file_id;
      const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      filePath = fileData.result?.file_path;
    }
    if (!filePath) {
      return res.status(404).send('Photo file path not found');
    }
    const imageRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`);
    if (!imageRes.ok) {
      return res.status(404).send('Photo not accessible');
    }
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageRes.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('Error fetching telegram avatar:', err);
    return res.status(500).send('Error retrieving profile photo');
  }
});

// -------------------------------------------------------------
// Database Helper: Authoritative User Fetching
// -------------------------------------------------------------
async function getAuthoritativeUser(userIdOrTelegramId: string): Promise<DbUser | null> {
  const identifier = String(userIdOrTelegramId || '').trim();
  if (!identifier) return null;

  // 1. Try Supabase
  if (serverSupabase) {
    try {
      let query = serverSupabase.from('users').select('*');
      if (identifier.startsWith('tg_') || identifier.includes('-')) {
        query = query.or(`id.eq.${identifier},telegram_id.eq.${identifier.replace('tg_', '')}`);
      } else {
        query = query.or(`telegram_id.eq.${identifier},id.eq.${identifier},id.eq.tg_${identifier}`);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          telegram_id: String(data.telegram_id || ''),
          first_name: data.first_name || '',
          last_name: data.last_name || null,
          username: data.username || null,
          photo_url: data.photo_url || null,
          referrer_id: data.referrer_id || null,
          referral_code: data.referral_code || '',
          balance: Number(data.balance) || 0,
          total_referrals: Number(data.total_referrals) || 0,
          level: Number(data.level) || 0,
          total_earned: Number(data.total_earned) || 0,
          total_withdrawn: Number(data.total_withdrawn) || 0,
          tasks_completed: Number(data.tasks_completed) || 0,
          completed_tasks: Array.isArray(data.completed_tasks) ? data.completed_tasks : [],
          daily_ads_watched: Number(data.daily_ads_watched) || 0,
          last_daily_bonus_date: data.last_daily_bonus_date || null,
          first_started_at: data.first_started_at || null,
          new_user_notified: Boolean(data.new_user_notified),
          created_at: data.created_at || new Date().toISOString()
        };
      }
    } catch (err: any) {
      console.warn('[getAuthoritativeUser Supabase Error]:', err.message);
    }
  }

  // 2. Persistent store
  return findLocalUser(identifier);
}

// Format DbUser to API profile response
function formatUserProfile(dbUser: DbUser) {
  const fullName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ').trim();
  const displayName = fullName || dbUser.first_name || (dbUser.username ? `@${dbUser.username}` : 'User');
  const username = dbUser.username ? (dbUser.username.startsWith('@') ? dbUser.username : `@${dbUser.username}`) : null;
  const today = new Date().toISOString().split('T')[0];
  const dailyBonusClaimedToday = dbUser.last_daily_bonus_date === today;

  return {
    id: dbUser.id,
    telegram_id: dbUser.telegram_id,
    first_name: dbUser.first_name,
    last_name: dbUser.last_name || null,
    display_name: displayName,
    username: username,
    photo_url: dbUser.photo_url || null,
    is_verified: Boolean(dbUser.telegram_id),
    telegram_verified: Boolean(dbUser.telegram_id),
    balance: Number(dbUser.balance) || 0,
    total_referrals: Number(dbUser.total_referrals) || 0,
    level: Number(dbUser.level) || 0,
    total_earned: Number(dbUser.total_earned) || 0,
    total_withdrawn: Number(dbUser.total_withdrawn) || 0,
    tasks_completed: Number(dbUser.tasks_completed) || 0,
    completed_tasks: Array.isArray(dbUser.completed_tasks) ? dbUser.completed_tasks : [],
    daily_ads_watched: Number(dbUser.daily_ads_watched) || 0,
    last_daily_bonus_date: dbUser.last_daily_bonus_date || null,
    daily_bonus_claimed_today: dailyBonusClaimedToday,
    referral_code: dbUser.referral_code,
    created_at: dbUser.created_at
  };
}

// GET /api/telegram-verify-status: Authoritative check against database
app.get('/api/telegram-verify-status', async (req: Request, res: Response) => {
  const telegramId = String(req.query.telegramId || '').trim();
  const userId = String(req.query.userId || '').trim();
  const identifier = telegramId || userId;
  if (!identifier) {
    return res.json({ verified: false, error: 'telegramId or userId is required' });
  }
  const dbUser = await getAuthoritativeUser(identifier);
  if (dbUser) {
    return res.json({
      verified: true,
      profile: formatUserProfile(dbUser)
    });
  }
  return res.json({ verified: false });
});

// GET /api/user/profile: Fetch latest authoritative user balance & profile
app.get('/api/user/profile', async (req: Request, res: Response) => {
  const userId = String(req.query.userId || '').trim();
  const telegramId = String(req.query.telegramId || '').trim();
  const identifier = userId || telegramId;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'userId or telegramId is required' });
  }
  const dbUser = await getAuthoritativeUser(identifier);
  if (!dbUser) {
    return res.status(404).json({ success: false, error: 'User not found in database' });
  }
  return res.json({
    success: true,
    profile: formatUserProfile(dbUser)
  });
});

// -------------------------------------------------------------
// POST /api/daily-bonus/claim: Authoritative Daily Bonus Credit
// -------------------------------------------------------------
app.post('/api/daily-bonus/claim', async (req: Request, res: Response) => {
  const { userId, telegramId } = req.body;
  const identifier = userId || telegramId;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'userId or telegramId is required' });
  }
  const dbUser = await getAuthoritativeUser(identifier);
  if (!dbUser) {
    return res.status(404).json({ success: false, error: 'User profile not found in database' });
  }
  const today = new Date().toISOString().split('T')[0];
  if (dbUser.last_daily_bonus_date === today) {
    return res.status(400).json({
      success: false,
      error: 'Daily reward already claimed today! Please return tomorrow.'
    });
  }
  const level = dbUser.level !== undefined ? dbUser.level : calculateTierLevel(dbUser.total_referrals || 0);
  const reward = calculateDailyReward(level);
  const newBal = +(Number(dbUser.balance || 0) + reward).toFixed(2);
  const newEarned = +(Number(dbUser.total_earned || 0) + reward).toFixed(2);

  if (serverSupabase) {
    try {
      await serverSupabase
        .from('users')
        .update({
          balance: newBal,
          total_earned: newEarned,
          last_daily_bonus_date: today
        })
        .eq('id', dbUser.id);
    } catch (err: any) {
      console.warn('[Daily Bonus Supabase Update Warning]:', err.message);
    }
  }

  dbUser.balance = newBal;
  dbUser.total_earned = newEarned;
  dbUser.last_daily_bonus_date = today;
  saveLocalUser(dbUser);

  return res.json({
    success: true,
    claimedReward: reward,
    newBalance: newBal,
    lastDailyBonusDate: today,
    user: formatUserProfile(dbUser)
  });
});

// -------------------------------------------------------------
// POST /api/balance/add-demo: Add Demo Balance (Persists to Database)
// -------------------------------------------------------------
app.post('/api/balance/add-demo', async (req: Request, res: Response) => {
  const { userId, telegramId, amount } = req.body;
  const identifier = userId || telegramId;
  const addAmount = Number(amount) || 0;
  if (!identifier || addAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid identifier or amount' });
  }
  const dbUser = await getAuthoritativeUser(identifier);
  if (!dbUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  const newBal = +(Number(dbUser.balance || 0) + addAmount).toFixed(2);
  const newEarned = +(Number(dbUser.total_earned || 0) + addAmount).toFixed(2);

  if (serverSupabase) {
    try {
      await serverSupabase
        .from('users')
        .update({
          balance: newBal,
          total_earned: newEarned
        })
        .eq('id', dbUser.id);
    } catch (err: any) {
      console.warn('[Add Demo Supabase Warning]:', err.message);
    }
  }

  dbUser.balance = newBal;
  dbUser.total_earned = newEarned;
  saveLocalUser(dbUser);

  return res.json({
    success: true,
    newBalance: newBal,
    totalEarned: newEarned
  });
});

// -------------------------------------------------------------
// Tasks Authoritative Anti-Fraud API
// -------------------------------------------------------------
app.get('/api/tasks', (_req: Request, res: Response) => {
  res.json({
    success: true,
    tasks: Object.values(REGISTERED_TASKS)
  });
});

app.get('/api/tasks/status', async (req: Request, res: Response) => {
  const userId = String(req.query.userId || '').trim();
  const telegramId = String(req.query.telegramId || '').trim();
  const identifier = userId || telegramId;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'userId or telegramId is required' });
  }
  const dbUser = await getAuthoritativeUser(identifier);
  const completedTasks = dbUser?.completed_tasks || [];
  return res.json({
    success: true,
    completedTasks,
    tasks: Object.values(REGISTERED_TASKS).map((t) => ({
      ...t,
      status: completedTasks.includes(t.id) ? 'completed' : 'pending'
    }))
  });
});

app.post('/api/tasks/open-intent', (req: Request, res: Response) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) {
    return res.status(400).json({ success: false, error: 'userId and taskId are required' });
  }
  const key = `${userId}_${taskId}`;
  taskOpenTimestamps.set(key, Date.now());
  return res.json({ success: true, timestamp: Date.now() });
});

app.post('/api/tasks/verify', async (req: Request, res: Response) => {
  const { userId, taskId, telegramId } = req.body;
  const identifier = userId || telegramId;
  if (!identifier || !taskId) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'userId/telegramId and taskId are required.'
    });
  }
  const task = REGISTERED_TASKS[taskId];
  if (!task) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_TASK',
      message: 'Invalid task identifier.'
    });
  }
  const lockKey = `${identifier}_${taskId}`;
  if (taskVerificationLocks.has(lockKey)) {
    return res.status(429).json({
      success: false,
      error: 'VERIFICATION_IN_PROGRESS',
      message: 'Task verification is already in progress. Please wait a moment.'
    });
  }
  taskVerificationLocks.add(lockKey);
  try {
    const dbUser = await getAuthoritativeUser(identifier);
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User profile not found in database.'
      });
    }
    const activeTelegramId = String(dbUser.telegram_id || telegramId || '').trim();
    if (!activeTelegramId) {
      return res.status(403).json({
        success: false,
        error: 'UNVERIFIED_ACCOUNT',
        message: 'You must verify your Telegram account first to complete tasks and earn rewards.'
      });
    }
    const existingCompleted = Array.isArray(dbUser.completed_tasks) ? dbUser.completed_tasks : [];
    if (existingCompleted.includes(taskId)) {
      return res.status(409).json({
        success: false,
        error: 'TASK_ALREADY_COMPLETED',
        message: 'This task has already been completed and rewarded.'
      });
    }
    // Minimum Dwell Time / Anti-Instant-Click Guard
    const openTime = taskOpenTimestamps.get(lockKey);
    const now = Date.now();
    if (!openTime || now - openTime < 3000) {
      return res.status(400).json({
        success: false,
        error: 'CHANNEL_NOT_OPENED',
        message: 'Please tap "Open Channel Link", join the Telegram channel, and then verify.'
      });
    }
    // Real Telegram Channel Membership Verification
    if (TELEGRAM_BOT_TOKEN && task.channelUsername) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const memberRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=@${task.channelUsername}&user_id=${activeTelegramId}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (memberData.ok && memberData.result) {
            const status = memberData.result.status;
            if (status === 'left' || status === 'kicked') {
              return res.status(400).json({
                success: false,
                error: 'NOT_JOINED',
                message: 'You have not joined this Telegram channel yet. Please join the channel first.'
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('[Task getChatMember Check Warning]:', err.message);
      }
    }
    // Atomic Reward Credit in Database
    const rewardAmount = task.reward;
    const newCompletedTasks = [...existingCompleted, taskId];
    const newTasksCompleted = (dbUser.tasks_completed || 0) + 1;
    const newBalance = +(Number(dbUser.balance || 0) + rewardAmount).toFixed(2);
    const newTotalEarned = +(Number(dbUser.total_earned || 0) + rewardAmount).toFixed(2);

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('users')
          .update({
            completed_tasks: newCompletedTasks,
            tasks_completed: newTasksCompleted,
            balance: newBalance,
            total_earned: newTotalEarned
          })
          .eq('id', dbUser.id);
      } catch (err: any) {
        console.warn('[Task Update Supabase Warning]:', err.message);
      }
    }

    dbUser.completed_tasks = newCompletedTasks;
    dbUser.tasks_completed = newTasksCompleted;
    dbUser.balance = newBalance;
    dbUser.total_earned = newTotalEarned;
    saveLocalUser(dbUser);
    taskOpenTimestamps.delete(lockKey);

    return res.json({
      success: true,
      taskId,
      rewardCredited: rewardAmount,
      newBalance,
      tasksCompleted: newTasksCompleted,
      completedTasks: newCompletedTasks
    });
  } catch (err: any) {
    console.error('[Task Verification Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during verification. Please try again.'
    });
  } finally {
    taskVerificationLocks.delete(lockKey);
  }
});

// -------------------------------------------------------------
// Authoritative 3-Step Watch Session Endpoints
// -------------------------------------------------------------
app.get('/api/ads/session/current', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }
  const existingSessionId = userCurrentSession.get(userId);
  if (existingSessionId && activeWatchSessions.has(existingSessionId)) {
    const session = activeWatchSessions.get(existingSessionId);
    if (session && !session.rewardClaimed) {
      return res.json({ success: true, session });
    }
  }
  return res.json({ success: true, session: null });
});

app.post('/api/ads/session/start', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }
  const existingSessionId = userCurrentSession.get(userId);
  if (existingSessionId && activeWatchSessions.has(existingSessionId)) {
    const session = activeWatchSessions.get(existingSessionId)!;
    if (!session.rewardClaimed) {
      return res.json({ success: true, session });
    }
  }
  const newSessionId = `ws_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const session: WatchSession = {
    sessionId: newSessionId,
    userId,
    completedCount: 0,
    totalRequired: 3,
    rewardEligible: false,
    rewardClaimed: false,
    rewardAmount: 2.00,
    stepTimestamps: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  activeWatchSessions.set(newSessionId, session);
  userCurrentSession.set(userId, newSessionId);
  return res.json({ success: true, session });
});

app.post('/api/ads/session/step-complete', (req: Request, res: Response) => {
  const { sessionId, userId, step } = req.body;
  if (!sessionId || !userId) {
    return res.status(400).json({ success: false, error: 'sessionId and userId are required' });
  }
  const session = activeWatchSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' });
  }
  if (session.userId !== userId) {
    return res.status(403).json({ success: false, error: 'Session does not belong to user' });
  }
  if (session.rewardClaimed) {
    return res.status(409).json({ success: false, error: 'REWARD_ALREADY_CLAIMED' });
  }
  if (session.completedCount >= step) {
    return res.json({ success: true, session });
  }
  if (step !== session.completedCount + 1) {
    return res.status(400).json({
      success: false,
      error: `INVALID_STEP_ORDER. Expected step ${session.completedCount + 1}, received ${step}`
    });
  }
  session.completedCount += 1;
  session.stepTimestamps.push(Date.now());
  session.updatedAt = Date.now();
  if (session.completedCount >= session.totalRequired) {
    session.rewardEligible = true;
  }
  return res.json({ success: true, session });
});

app.post('/api/ads/session/claim-reward', async (req: Request, res: Response) => {
  const { sessionId, userId, telegramId } = req.body;
  const identifier = userId || telegramId;
  if (!sessionId || !identifier) {
    return res.status(400).json({ success: false, error: 'sessionId and userId are required' });
  }
  const lockKey = `${sessionId}_${identifier}`;
  if (claimInProgressLocks.has(lockKey)) {
    return res.status(429).json({ success: false, error: 'CLAIM_IN_PROGRESS' });
  }
  claimInProgressLocks.add(lockKey);
  try {
    const session = activeWatchSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (session.userId !== userId && session.userId !== identifier) {
      return res.status(403).json({ success: false, error: 'Unauthorized session' });
    }
    if (session.rewardClaimed) {
      return res.status(409).json({ success: false, error: 'REWARD_ALREADY_CLAIMED' });
    }
    if (session.completedCount < session.totalRequired || !session.rewardEligible) {
      return res.status(400).json({ 
        success: false, 
        error: `NOT_ELIGIBLE_FOR_REWARD. Completed: ${session.completedCount}/${session.totalRequired}` 
      });
    }
    const dbUser = await getAuthoritativeUser(identifier);
    if (!dbUser) {
      return res.status(404).json({ success: false, error: 'User profile not found in database' });
    }
    session.rewardClaimed = true;
    session.claimedAt = Date.now();
    session.updatedAt = Date.now();
    const rewardAmount = session.rewardAmount;
    const newBal = +(Number(dbUser.balance || 0) + rewardAmount).toFixed(2);
    const newEarned = +(Number(dbUser.total_earned || 0) + rewardAmount).toFixed(2);
    const newAds = Number(dbUser.daily_ads_watched || 0) + 1;

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('users')
          .update({
            balance: newBal,
            total_earned: newEarned,
            daily_ads_watched: newAds
          })
          .eq('id', dbUser.id);
      } catch (dbErr: any) {
        console.warn('[Supabase Claim Credit Warning]:', dbErr.message);
      }
    }

    dbUser.balance = newBal;
    dbUser.total_earned = newEarned;
    dbUser.daily_ads_watched = newAds;
    saveLocalUser(dbUser);

    userCurrentSession.delete(userId);
    if (identifier) userCurrentSession.delete(identifier);

    return res.json({
      success: true,
      rewardCredited: rewardAmount,
      newBalance: newBal,
      dailyAdsWatched: newAds,
      session
    });
  } finally {
    claimInProgressLocks.delete(lockKey);
  }
});

// -------------------------------------------------------------
// Direct Ad Endpoints (Step 1, Step 2, Step 3)
// -------------------------------------------------------------
app.get('/ad/step/:step', (req: Request, res: Response) => {
  const step = parseInt(req.params.step, 10);
  if (step === 1) {
    return res.redirect('https://www.profitableratecpmnetwork.com/fgrit5jz?key=e65cf7bc7f3056f69c8d0e969a21f7f1');
  }
  if (step === 2) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>X BOOST Sponsor Ad</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0c081e;
      color: #cbd5e1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      box-sizing: border-box;
      text-align: center;
    }
    #container-9aabc165e03a30d8c91eb0ae0ce875de {
      width: 100%;
      max-width: 400px;
      margin: 20px auto;
    }
  </style>
</head>
<body>
  <div style="font-weight: 700; color: #fff; font-size: 16px; margin-bottom: 8px;">X BOOST Sponsor Ad</div>
  <div style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">Engage with the sponsor content below, then return to X BOOST.</div>
  <div id="container-9aabc165e03a30d8c91eb0ae0ce875de"></div>
  <script async="async" data-cfasync="false" src="https://pl31601414.profitableratecpmnetwork.com/9aabc165e03a30d8c91eb0ae0ce875de/invoke.js"></script>
</body>
</html>`);
  }
  if (step === 3) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>X BOOST Step 3 Sponsor Ad</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0c081e;
      color: #cbd5e1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #140e2d;
      border: 1px solid #3b1d6e;
      border-radius: 20px;
      padding: 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(168,85,247,0.2);
      border-top-color: #a855f7;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 16px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card" id="ad-card">
    <div style="font-weight:800; color:#fff; font-size:18px; margin-bottom:8px;">X BOOST Sponsor Ad</div>
    <div id="status-text" style="font-size:12px; color:#94a3b8; margin-bottom:16px;">Loading Step 3 sponsor advertisement...</div>
    <div class="spinner" id="spinner"></div>
    <div id="fallback-action" style="display:none; margin-top:16px;">
      <a id="fallback-link" href="https://www.profitableratecpmnetwork.com/hbtaw7z2zp?key=3a083e88e287d42b14c238b78187d111" style="display:inline-block; padding:12px 24px; background:linear-gradient(to right, #7c25d3, #6366f1); color:#fff; border-radius:12px; text-decoration:none; font-weight:700; font-size:13px;">Continue to Sponsor Ad →</a>
    </div>
  </div>
  <script>
    const FALLBACK_URL = "https://www.profitableratecpmnetwork.com/hbtaw7z2zp?key=3a083e88e287d42b14c238b78187d111";
    console.log("[ADS] Step 3 primary started");
    var primaryResolved = false;
    var fallbackTriggered = false;
    function activateFallback(reason) {
      if (primaryResolved || fallbackTriggered) return;
      fallbackTriggered = true;
      console.warn("[ADS] Step 3 primary failed (" + reason + ")");
      console.log("[ADS] Step 3 fallback started");
      try {
        if (window.opener) {
          window.opener.postMessage({ type: "STEP_3_FALLBACK_TRIGGERED" }, "*");
        }
      } catch (e) {}
      var s = document.getElementById("primary-step3-script");
      if (s) {
        try { s.remove(); } catch (e) {}
      }
      var statusElem = document.getElementById("status-text");
      if (statusElem) statusElem.innerText = "Redirecting to sponsor destination...";
      var fallbackBtn = document.getElementById("fallback-action");
      if (fallbackBtn) fallbackBtn.style.display = "block";
      setTimeout(function() {
        window.location.replace(FALLBACK_URL);
      }, 400);
    }
    var fallbackTimer = setTimeout(function() {
      if (!primaryResolved) {
        activateFallback("timeout");
      }
    }, 3500);
    try {
      var script = document.createElement("script");
      script.id = "primary-step3-script";
      script.src = "https://pl31601426.profitableratecpmnetwork.com/c1/bd/0d/c1bd0d67885d296100e36dfc496e1eea.js";
      script.async = true;
      script.onload = function() {
        primaryResolved = true;
        clearTimeout(fallbackTimer);
        console.log("[ADS] Step 3 primary loaded");
        var statusElem = document.getElementById("status-text");
        if (statusElem) statusElem.innerText = "Sponsor ad active. Please engage with content, then return to X BOOST.";
        try {
          if (window.opener) {
            window.opener.postMessage({ type: "STEP_3_PRIMARY_LOADED" }, "*");
          }
        } catch (e) {}
      };
      script.onerror = function() {
        clearTimeout(fallbackTimer);
        activateFallback("script_error");
      };
      document.body.appendChild(script);
    } catch (err) {
      clearTimeout(fallbackTimer);
      activateFallback("injection_error");
    }
  </script>
</body>
</html>`);
  }
  return res.status(404).send('Invalid step');
});

// -------------------------------------------------------------
// GET /api/referrals: Fetch Referrals for a User from Database
// -------------------------------------------------------------
app.get('/api/referrals', async (req: Request, res: Response) => {
  const userId = String(req.query.userId || '').trim();
  const telegramId = String(req.query.telegramId || '').trim();
  const identifier = userId || telegramId;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'userId or telegramId is required' });
  }
  const referrer = await getAuthoritativeUser(identifier);
  if (!referrer) {
    return res.json({ success: true, referrals: [], totalReferrals: 0 });
  }
  const referralsList: DbReferral[] = [];
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', referrer.id)
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const r of data) {
          referralsList.push({
            id: r.id,
            referrer_id: r.referrer_id,
            referred_id: r.referred_id,
            referred_telegram_id: r.referred_telegram_id,
            referred_display_name: r.referred_display_name || 'Member',
            status: r.status || 'confirmed',
            reward_amount: Number(r.reward_amount) || 50.00,
            created_at: r.created_at || new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.warn('[Fetch Referrals Supabase Warning]:', err.message);
    }
  }

  if (referralsList.length === 0) {
    const localRefs = memoryStore.referrals.filter(
      (r) => r.referrer_id === referrer.id || r.referrer_id === referrer.telegram_id
    );
    referralsList.push(...localRefs);
  }

  return res.json({
    success: true,
    totalReferrals: Math.max(referrer.total_referrals, referralsList.length),
    referrals: referralsList.map((r) => ({
      id: r.id,
      referrerUid: r.referrer_id,
      referredUid: r.referred_id,
      referredTelegramId: r.referred_telegram_id,
      referredDisplayName: r.referred_display_name,
      createdAt: r.created_at,
      status: 'confirmed'
    }))
  });
});

// -------------------------------------------------------------
// POST /api/referrals/process: Idempotent & Fraud-Protected Referral Credit
// -------------------------------------------------------------
app.post('/api/referrals/process', async (req: Request, res: Response) => {
  const { referrerId, referrerCode, telegramId, referredTelegramUser } = req.body;
  if (!referredTelegramUser || !referredTelegramUser.id) {
    return res.status(400).json({ success: false, error: 'referredTelegramUser object is required.' });
  }
  const cleanReferredTgId = String(referredTelegramUser.id).trim();
  const referredName = referredTelegramUser.name || referredTelegramUser.username || `User_${cleanReferredTgId.slice(-4)}`;

  // 1. Identify Referrer
  let referrer: DbUser | null = null;
  if (referrerCode) {
    referrer = findLocalUser(referrerCode);
    if (!referrer && serverSupabase) {
      const { data } = await serverSupabase.from('users').select('*').eq('referral_code', referrerCode.toUpperCase()).maybeSingle();
      if (data) referrer = await getAuthoritativeUser(data.id);
    }
  }
  if (!referrer && (referrerId || telegramId)) {
    referrer = await getAuthoritativeUser(referrerId || telegramId);
  }
  if (!referrer) {
    return res.status(404).json({ success: false, error: 'Referrer profile not found in database.' });
  }

  // 2. SELF-REFERRAL PROTECTION
  if (
    referrer.telegram_id === cleanReferredTgId ||
    referrer.id === cleanReferredTgId ||
    referrer.id === `tg_${cleanReferredTgId}`
  ) {
    return res.status(400).json({
      success: false,
      error: 'Self-referral is strictly prohibited. You cannot refer yourself.'
    });
  }

  // 3. DUPLICATE REFERRAL PROTECTION
  if (serverSupabase) {
    try {
      const { data: existingRef } = await serverSupabase
        .from('referrals')
        .select('id')
        .eq('referred_telegram_id', cleanReferredTgId)
        .maybeSingle();
      if (existingRef) {
        return res.status(409).json({
          success: false,
          error: `Duplicate referral: Telegram user ${cleanReferredTgId} has already been referred.`
        });
      }
    } catch (err: any) {
      console.warn('[Check Duplicate Ref Supabase Warning]:', err.message);
    }
  }

  const existingLocalRef = memoryStore.referrals.find((r) => r.referred_telegram_id === cleanReferredTgId);
  if (existingLocalRef) {
    return res.status(409).json({
      success: false,
      error: `Duplicate referral: Telegram user ${cleanReferredTgId} has already been referred.`
    });
  }

  // 4. Create Referred User Record
  const newReferredUid = `tg_${cleanReferredTgId}`;
  let existingReferredUser = await getAuthoritativeUser(newReferredUid);
  if (existingReferredUser && existingReferredUser.referrer_id) {
    return res.status(409).json({
      success: false,
      error: 'User already has a confirmed permanent referrer.'
    });
  }

  const refRecordId = `ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const referralRecord: DbReferral = {
    id: refRecordId,
    referrer_id: referrer.id,
    referred_id: newReferredUid,
    referred_telegram_id: cleanReferredTgId,
    referred_display_name: referredName,
    status: 'confirmed',
    reward_amount: 50.00,
    created_at: new Date().toISOString()
  };

  // 5. Atomic Update
  const newTotalRefs = (referrer.total_referrals || 0) + 1;
  const newLevel = calculateTierLevel(newTotalRefs);
  const newBal = +(Number(referrer.balance || 0) + 50.00).toFixed(2);
  const newEarned = +(Number(referrer.total_earned || 0) + 50.00).toFixed(2);

  if (serverSupabase) {
    try {
      await serverSupabase
        .from('referrals')
        .insert({
          id: refRecordId,
          referrer_id: referrer.id,
          referred_id: newReferredUid,
          referred_telegram_id: cleanReferredTgId,
          referred_display_name: referredName,
          status: 'confirmed',
          reward_amount: 50.00,
          created_at: referralRecord.created_at
        });
      await serverSupabase
        .from('users')
        .update({
          total_referrals: newTotalRefs,
          level: newLevel,
          balance: newBal,
          total_earned: newEarned
        })
        .eq('id', referrer.id);

      if (existingReferredUser) {
        await serverSupabase
          .from('users')
          .update({ referrer_id: referrer.id })
          .eq('id', existingReferredUser.id);
      } else {
        await serverSupabase
          .from('users')
          .insert({
            id: newReferredUid,
            telegram_id: cleanReferredTgId,
            first_name: referredName,
            username: referredTelegramUser.username || null,
            referrer_id: referrer.id,
            referral_code: crypto.createHash('md5').update(cleanReferredTgId).digest('hex').slice(0, 6).toUpperCase(),
            balance: 0,
            total_referrals: 0,
            level: 0,
            total_earned: 0,
            total_withdrawn: 0,
            tasks_completed: 0,
            completed_tasks: [],
            daily_ads_watched: 0,
            created_at: new Date().toISOString()
          });
      }
    } catch (err: any) {
      console.warn('[Process Referral Supabase Warning]:', err.message);
    }
  }

  referrer.total_referrals = newTotalRefs;
  referrer.level = newLevel;
  referrer.balance = newBal;
  referrer.total_earned = newEarned;
  saveLocalUser(referrer);
  memoryStore.referrals.unshift(referralRecord);
  savePersistentStore();

  const formattedRef = {
    id: referralRecord.id,
    referrerUid: referralRecord.referrer_id,
    referredUid: referralRecord.referred_id,
    referredTelegramId: referralRecord.referred_telegram_id,
    referredDisplayName: referralRecord.referred_display_name,
    createdAt: referralRecord.created_at,
    status: 'confirmed' as const
  };

  return res.json({
    success: true,
    newReferral: formattedRef,
    updatedReferrer: formatUserProfile(referrer)
  });
});

// -------------------------------------------------------------
// Telegram Authentication & Verification Endpoint
// -------------------------------------------------------------
async function processTelegramVerification(req: Request, res: Response) {
  try {
    const { initData, startParam, currentUserId: _currentUserId, unsafeUser } = req.body;
    let tgUser: any = null;
    let authDate: number | undefined = undefined;

    if (initData && TELEGRAM_BOT_TOKEN) {
      const validationResult = validateTelegramWebAppData(initData, TELEGRAM_BOT_TOKEN);
      if (validationResult.isValid && validationResult.user) {
        tgUser = validationResult.user;
        authDate = validationResult.auth_date;
      }
    }

    if (!tgUser && unsafeUser && unsafeUser.id) {
      tgUser = {
        id: String(unsafeUser.id),
        first_name: unsafeUser.first_name || '',
        last_name: unsafeUser.last_name || '',
        username: unsafeUser.username || '',
        photo_url: unsafeUser.photo_url || ''
      };
    }

    if (!tgUser || !tgUser.id) {
      return res.status(400).json({ 
        success: false, 
        verified: false, 
        error: 'Telegram identity not detected. Please ensure you are opening inside Telegram.' 
      });
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (authDate && authDate > nowInSeconds + 900) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: 'Telegram authentication timestamp invalid (future dated).'
      });
    }

    const referralCode = (startParam || '').trim().toUpperCase();
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim();
    const displayName = fullName || tgUser.first_name || (tgUser.username ? `@${tgUser.username}` : 'User');
    const cleanUsername = tgUser.username ? tgUser.username.replace(/^@/, '').trim() : null;
    let photoUrl = tgUser.photo_url || null;

    if (!photoUrl && TELEGRAM_BOT_TOKEN) {
      try {
        photoUrl = await getTelegramUserProfilePhoto(tgUser.id, TELEGRAM_BOT_TOKEN);
      } catch (photoErr) {
        console.warn('Telegram photo retrieval ignored:', photoErr);
      }
    }

    let isNewUser = false;
    let referralConfirmed = false;
    let dbUser: DbUser | null = await getAuthoritativeUser(String(tgUser.id));

    if (dbUser) {
      dbUser.first_name = tgUser.first_name || dbUser.first_name;
      dbUser.last_name = tgUser.last_name || dbUser.last_name;
      dbUser.username = cleanUsername || dbUser.username;
      dbUser.photo_url = photoUrl || dbUser.photo_url;
      if (serverSupabase) {
        try {
          await serverSupabase
            .from('users')
            .update({
              first_name: dbUser.first_name,
              last_name: dbUser.last_name,
              username: dbUser.username,
              photo_url: dbUser.photo_url
            })
            .eq('id', dbUser.id);
        } catch (err: any) {
          console.warn('[Update User Supabase Warning]:', err.message);
        }
      }
      saveLocalUser(dbUser);
    } else {
      isNewUser = true;
      const uniqueReferralCode = crypto.createHash('md5').update(String(tgUser.id)).digest('hex').slice(0, 6).toUpperCase();
      let referrerId: string | null = null;
      let referrerChatIdForNotification: string | null = null;

      if (referralCode) {
        let referrer: DbUser | null = null;
        if (serverSupabase) {
          try {
            const { data } = await serverSupabase.from('users').select('*').eq('referral_code', referralCode).maybeSingle();
            if (data) referrer = await getAuthoritativeUser(data.id);
          } catch {}
        }
        if (!referrer) {
          referrer = findLocalUser(referralCode);
        }

        if (
          referrer &&
          String(referrer.telegram_id) !== String(tgUser.id) &&
          referrer.id !== `tg_${tgUser.id}`
        ) {
          referrerChatIdForNotification = referrer.telegram_id || referrer.referral_code;
          let isDuplicate = false;
          if (serverSupabase) {
            try {
              const { data: refRow } = await serverSupabase.from('referrals').select('id').eq('referred_telegram_id', String(tgUser.id)).maybeSingle();
              if (refRow) isDuplicate = true;
            } catch {}
          }
          if (!isDuplicate && memoryStore.referrals.some((r) => r.referred_telegram_id === String(tgUser.id))) {
            isDuplicate = true;
          }

          if (!isDuplicate) {
            referrerId = referrer.id;
            referralConfirmed = true;
            const newTotalRefs = (referrer.total_referrals || 0) + 1;
            const newLevel = calculateTierLevel(newTotalRefs);
            const newBal = +(Number(referrer.balance || 0) + 50.00).toFixed(2);
            const newEarned = +(Number(referrer.total_earned || 0) + 50.00).toFixed(2);

            const refRecordId = `ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            const refRecord: DbReferral = {
              id: refRecordId,
              referrer_id: referrer.id,
              referred_id: `tg_${tgUser.id}`,
              referred_telegram_id: String(tgUser.id),
              referred_display_name: displayName,
              status: 'confirmed',
              reward_amount: 50.00,
              created_at: new Date().toISOString()
            };

            if (serverSupabase) {
              try {
                await serverSupabase.from('referrals').insert({
                  id: refRecordId,
                  referrer_id: referrer.id,
                  referred_id: `tg_${tgUser.id}`,
                  referred_telegram_id: String(tgUser.id),
                  referred_display_name: displayName,
                  status: 'confirmed',
                  reward_amount: 50.00,
                  created_at: refRecord.created_at
                });
                await serverSupabase.from('users').update({
                  total_referrals: newTotalRefs,
                  level: newLevel,
                  balance: newBal,
                  total_earned: newEarned
                }).eq('id', referrer.id);
              } catch (e: any) {
                console.warn('[Referral Insert Supabase Warning]:', e.message);
              }
            }

            referrer.total_referrals = newTotalRefs;
            referrer.level = newLevel;
            referrer.balance = newBal;
            referrer.total_earned = newEarned;
            saveLocalUser(referrer);
            memoryStore.referrals.unshift(refRecord);
            savePersistentStore();
          }
        }
      }

      dbUser = {
        id: `tg_${tgUser.id}`,
        telegram_id: String(tgUser.id),
        first_name: tgUser.first_name,
        last_name: tgUser.last_name || null,
        username: cleanUsername,
        photo_url: photoUrl,
        referrer_id: referrerId,
        referral_code: uniqueReferralCode,
        balance: 0,
        total_referrals: 0,
        level: 0,
        total_earned: 0,
        total_withdrawn: 0,
        tasks_completed: 0,
        completed_tasks: [],
        daily_ads_watched: 0,
        last_daily_bonus_date: null,
        first_started_at: new Date().toISOString(),
        new_user_notified: false,
        created_at: new Date().toISOString()
      };

      if (serverSupabase) {
        try {
          await serverSupabase.from('users').insert({
            id: dbUser.id,
            telegram_id: dbUser.telegram_id,
            first_name: dbUser.first_name,
            last_name: dbUser.last_name,
            username: dbUser.username,
            photo_url: dbUser.photo_url,
            referrer_id: dbUser.referrer_id,
            referral_code: dbUser.referral_code,
            balance: 0,
            total_referrals: 0,
            level: 0,
            total_earned: 0,
            total_withdrawn: 0,
            tasks_completed: 0,
            completed_tasks: [],
            daily_ads_watched: 0,
            last_daily_bonus_date: null,
            first_started_at: dbUser.first_started_at,
            new_user_notified: false,
            created_at: dbUser.created_at
          });
        } catch (err: any) {
          console.warn('[Create User Supabase Warning]:', err.message);
        }
      }
      saveLocalUser(dbUser);
    }

    const responseProfile = formatUserProfile(dbUser);
    return res.json({
      success: true,
      verified: true,
      isNewUser,
      referralConfirmed,
      telegramUser: {
        id: tgUser.id,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name || '',
        username: tgUser.username || '',
        photo_url: photoUrl
      },
      profile: responseProfile
    });
  } catch (err: any) {
    console.error('Server processTelegramVerification error:', err);
    res.status(500).json({ success: false, verified: false, error: err.message || 'Internal server error' });
  }
}

app.post('/api/telegram-verify', processTelegramVerification);
app.post('/api/telegram-auth', processTelegramVerification);

// -------------------------------------------------------------
// WITHDRAWALS API: Create, Fetch, and Sync
// -------------------------------------------------------------
app.get('/api/withdrawals', async (req: Request, res: Response) => {
  const userId = String(req.query.userId || '').trim();
  const telegramId = String(req.query.telegramId || '').trim();
  const identifier = userId || telegramId;

  let withdrawals = memoryStore.withdrawals;
  if (identifier && identifier !== '00000000-0000-4000-8000-000000000001') {
    withdrawals = withdrawals.filter(
      (w) => w.user_id === identifier || w.telegram_id === identifier || w.user_id === `tg_${identifier}`
    );
  }

  // Also query Supabase if active
  if (serverSupabase) {
    try {
      let query = serverSupabase.from('withdrawals').select('*').order('created_at', { ascending: false });
      if (identifier && identifier !== '00000000-0000-4000-8000-000000000001') {
        query = query.or(`user_id.eq.${identifier},telegram_id.eq.${identifier.replace('tg_', '')}`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return res.json({
          success: true,
          withdrawals: data.map((d) => ({
            ...d,
            created_at_formatted: d.dhaka_time || d.created_at
          }))
        });
      }
    } catch (e: any) {
      console.warn('[Fetch Withdrawals Supabase Warning]:', e.message);
    }
  }

  return res.json({
    success: true,
    withdrawals: withdrawals.map((w) => ({
      ...w,
      created_at_formatted: w.dhaka_time || w.created_at
    }))
  });
});

app.post('/api/withdrawals/create', async (req: Request, res: Response) => {
  const { userId, telegramId, userName, method, accountNumber, amount } = req.body;
  const identifier = userId || telegramId;
  const numAmount = Number(amount) || 0;
  const cleanNumber = String(accountNumber || '').trim();

  // 1. Validation
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'User identification is required.' });
  }
  if (!cleanNumber || !/^01\d{9}$/.test(cleanNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Bangladesh mobile number. Must be 11 digits starting with 01 (e.g. 01712345678).'
    });
  }
  if (numAmount < 1500) {
    return res.status(400).json({
      success: false,
      error: 'Minimum withdrawal amount is ৳ 1500.'
    });
  }
  if (method !== 'bkash' && method !== 'nagad') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment method. Only bKash and Nagad are accepted.'
    });
  }

  const dbUser = await getAuthoritativeUser(identifier);
  if (!dbUser) {
    return res.status(404).json({ success: false, error: 'User account not found.' });
  }
  if (Number(dbUser.balance || 0) < numAmount) {
    return res.status(400).json({
      success: false,
      error: `Insufficient balance! You have ৳ ${Number(dbUser.balance || 0).toFixed(2)}, but requested ৳ ${numAmount.toFixed(2)}.`
    });
  }

  // 2. Calculations: Formula: Every 500 withdrawal amount = 100 charge
  const charge = +((numAmount / 500) * 100).toFixed(2);
  const receiveAmount = +(numAmount - charge).toFixed(2);
  const newBalance = +(Number(dbUser.balance) - numAmount).toFixed(2);
  const newTotalWithdrawn = +(Number(dbUser.total_withdrawn || 0) + receiveAmount).toFixed(2);

  // 3. User Name & Dhaka Time
  const fullName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ').trim();
  const displayName = fullName || dbUser.first_name || userName || (dbUser.username ? `@${dbUser.username}` : 'User');
  const dhakaTime = formatDhakaDateTime(new Date());

  // 4. Create Withdrawal Record
  const withdrawalId = `TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const withdrawal: DbWithdrawal = {
    id: withdrawalId,
    user_id: dbUser.id,
    telegram_id: dbUser.telegram_id || String(telegramId || ''),
    user_name: displayName,
    method: method as 'bkash' | 'nagad',
    account_number: cleanNumber,
    amount: numAmount,
    charge,
    receive_amount: receiveAmount,
    status: 'Pending',
    telegram_message_id: null,
    telegram_group_id: TELEGRAM_WITHDRAW_GROUP_ID || null,
    created_at: new Date().toISOString(),
    dhaka_time: dhakaTime
  };

  // 5. Update user and insert withdrawal in Database (Supabase + MemoryStore)
  if (serverSupabase) {
    try {
      await serverSupabase
        .from('users')
        .update({
          balance: newBalance,
          total_withdrawn: newTotalWithdrawn
        })
        .eq('id', dbUser.id);

      await serverSupabase
        .from('withdrawals')
        .insert({
          id: withdrawal.id,
          user_id: withdrawal.user_id,
          telegram_id: withdrawal.telegram_id,
          user_name: withdrawal.user_name,
          method: withdrawal.method,
          account_number: withdrawal.account_number,
          amount: withdrawal.amount,
          charge: withdrawal.charge,
          receive_amount: withdrawal.receive_amount,
          status: withdrawal.status,
          telegram_message_id: null,
          telegram_group_id: withdrawal.telegram_group_id,
          created_at: withdrawal.created_at,
          dhaka_time: withdrawal.dhaka_time
        });
    } catch (err: any) {
      console.warn('[Withdrawal Supabase Insert Warning]:', err.message);
    }
  }

  dbUser.balance = newBalance;
  dbUser.total_withdrawn = newTotalWithdrawn;
  saveLocalUser(dbUser);

  memoryStore.withdrawals.unshift(withdrawal);
  savePersistentStore();

  // 6. Send Telegram Notification immediately to the Telegram Group
  // Telegram API failure MUST NOT break the withdrawal process
  try {
    const notifyRes = await sendWithdrawalNotificationToGroup(withdrawal);
    if (notifyRes.ok && notifyRes.messageId) {
      console.log(`[Withdrawal] Telegram notification sent with message_id=${notifyRes.messageId} for withdrawal ${withdrawal.id}`);
      if (serverSupabase) {
        try {
          await serverSupabase
            .from('withdrawals')
            .update({
              telegram_message_id: notifyRes.messageId,
              telegram_group_id: withdrawal.telegram_group_id
            })
            .eq('id', withdrawal.id);
        } catch {}
      }
    }
  } catch (tgErr: any) {
    console.error('[Withdrawal Telegram Group Notification Error]:', tgErr.message);
  }

  return res.json({
    success: true,
    withdrawal: {
      ...withdrawal,
      created_at_formatted: withdrawal.dhaka_time
    },
    newBalance,
    totalWithdrawn: newTotalWithdrawn
  });
});

// -------------------------------------------------------------
// Telegram Webhook Handler
// Handles:
// 1. /start command -> New User detection, stores user, sends New User Group notification ONCE
// 2. Admin Reply on Withdraw Request in Group -> Updates withdrawal status
// -------------------------------------------------------------
app.post('/api/telegram-webhook', async (req: Request, res: Response) => {
  const update = req.body;
  if (!update || !update.update_id) {
    return res.status(200).json({ ok: true });
  }
  if (processedUpdateIds.has(update.update_id)) {
    return res.status(200).json({ ok: true });
  }
  processedUpdateIds.add(update.update_id);

  const message = update.message;
  if (!message) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const chatType = message.chat.type; // 'private', 'group', 'supergroup', 'channel'
  const text = (message.text || '').trim();
  const senderId = message.from ? String(message.from.id) : '';
  const senderFirstName = message.from?.first_name || '';
  const senderLastName = message.from?.last_name || '';
  const senderFullName = [senderFirstName, senderLastName].filter(Boolean).join(' ').trim() || 'Telegram User';
  const senderUsername = message.from?.username || null;

  const webAppBaseUrl = TELEGRAM_WEBAPP_URL || `${req.protocol}://${req.get('host')}`;

  // ===========================================================
  // CASE A: ADMIN REPLY TO A WITHDRAW REQUEST MESSAGE IN GROUP
  // ===========================================================
  if (message.reply_to_message && text) {
    const originalMsg = message.reply_to_message;
    const repliedMsgId = originalMsg.message_id;

    console.log(`[Telegram Webhook Reply] Received reply to message_id=${repliedMsgId} from chat=${chatId}, text="${text}"`);

    // 1. Security Check: Verify chat and admin sender
    const cleanChatId = String(chatId);
    const cleanWithdrawGroupId = String(TELEGRAM_WITHDRAW_GROUP_ID || '').trim();

    // Check if chat matches configured group or is a group/supergroup
    const isGroupChat = chatType === 'group' || chatType === 'supergroup';
    const isMatchingGroup = cleanWithdrawGroupId 
      ? (cleanChatId === cleanWithdrawGroupId || cleanChatId === cleanWithdrawGroupId.replace('-100', '-'))
      : isGroupChat;

    // Check optional admin IDs if configured
    let isAuthorizedAdmin = true;
    if (TELEGRAM_ADMIN_IDS.length > 0 && senderId) {
      isAuthorizedAdmin = TELEGRAM_ADMIN_IDS.includes(senderId);
    }

    if (!isMatchingGroup || !isAuthorizedAdmin) {
      console.warn(`[Telegram Webhook Reply]: Unauthorized reply ignored. chatId=${cleanChatId}, senderId=${senderId}`);
      return;
    }

    // 2. Identify the corresponding withdrawal record by original message_id
    let matchingWithdrawal = memoryStore.withdrawals.find(
      (w) => w.telegram_message_id === repliedMsgId
    );

    if (!matchingWithdrawal) {
      // Re-check disk store in case updated
      const reloaded = loadPersistentStore();
      matchingWithdrawal = reloaded.withdrawals.find((w) => w.telegram_message_id === repliedMsgId);
      if (matchingWithdrawal) {
        memoryStore = reloaded;
      }
    }

    if (!matchingWithdrawal && serverSupabase) {
      try {
        const { data: dbTx } = await serverSupabase
          .from('withdrawals')
          .select('*')
          .eq('telegram_message_id', repliedMsgId)
          .maybeSingle();
        if (dbTx) {
          matchingWithdrawal = {
            id: dbTx.id,
            user_id: dbTx.user_id,
            telegram_id: dbTx.telegram_id,
            user_name: dbTx.user_name,
            method: dbTx.method,
            account_number: dbTx.account_number,
            amount: Number(dbTx.amount),
            charge: Number(dbTx.charge),
            receive_amount: Number(dbTx.receive_amount),
            status: dbTx.status,
            telegram_message_id: dbTx.telegram_message_id,
            telegram_group_id: dbTx.telegram_group_id,
            created_at: dbTx.created_at,
            dhaka_time: dbTx.dhaka_time || formatDhakaDateTime(new Date(dbTx.created_at))
          };
          memoryStore.withdrawals.unshift(matchingWithdrawal);
        }
      } catch (err: any) {
        console.warn('[Find Withdrawal by Telegram Msg ID Supabase Warning]:', err.message);
      }
    }

    // If message is unrelated or replied to something other than a withdrawal notification
    if (!matchingWithdrawal) {
      console.log(`[Telegram Webhook Reply]: No withdrawal found matching telegram_message_id=${repliedMsgId}. Ignoring.`);
      return;
    }

    // 3. Status Synchronization Rules:
    // "Complete"  -> "Complete"
    // "Next Day"  -> "Next Day"
    // "Rejected"  -> "Rejected"
    // or use reply text
    const lowerText = text.toLowerCase();
    let newStatus = text;

    if (lowerText === 'complete' || lowerText === 'completed' || lowerText === 'approved' || lowerText === 'done') {
      newStatus = 'Complete';
    } else if (lowerText === 'next day' || lowerText === 'nextday') {
      newStatus = 'Next Day';
    } else if (lowerText === 'rejected' || lowerText === 'reject' || lowerText === 'cancel' || lowerText === 'cancelled') {
      newStatus = 'Rejected';
    } else if (lowerText === 'pending') {
      newStatus = 'Pending';
    }

    // If status is unchanged, avoid redundant updates
    if (matchingWithdrawal.status === newStatus) {
      console.log(`[Telegram Webhook Reply]: Withdrawal ${matchingWithdrawal.id} is already in status "${newStatus}". Skipping redundant update.`);
      return res.status(200).json({ ok: true });
    }

    console.log(`[Telegram Webhook Reply]: Updating withdrawal ${matchingWithdrawal.id} status: "${matchingWithdrawal.status}" -> "${newStatus}"`);
    matchingWithdrawal.status = newStatus;
    savePersistentStore();

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('withdrawals')
          .update({ status: newStatus })
          .eq('id', matchingWithdrawal.id);
      } catch (err: any) {
        console.warn('[Update Withdrawal Status Supabase Warning]:', err.message);
      }
    }

    // Optional confirmation reaction or reply in group
    try {
      if (TELEGRAM_BOT_TOKEN) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            reply_to_message_id: message.message_id,
            text: `✅ Withdrawal [${matchingWithdrawal.id}] status updated to: *${newStatus}*`,
            parse_mode: 'Markdown'
          })
        });
      }
    } catch {}

    return res.status(200).json({ ok: true });
  }

  // ===========================================================
  // CASE B: USER SENDS /start IN TELEGRAM BOT
  // ===========================================================
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const rawParam = parts.length > 1 ? parts[1].trim() : null;
    const referralCode = rawParam ? rawParam.toUpperCase() : null;

    let webAppUrl = webAppBaseUrl;
    let welcomeText = `🚀 Welcome to **X BOOST**!\n\n📺 Watch Rewarded Video Ads\n📋 Complete Telegram Channel Tasks\n👥 Invite Friends & Earn ৳ 50.00 per Referral\n⭐ Level up to VIP for ৳ 80.00 Daily Bonus!\n📢 Official Channel: https://t.me/xboost_comionitiy\n💳 Fast Payouts via bKash & Nagad (Min. ৳ 1500)`;

    if (referralCode) {
      webAppUrl = `${webAppBaseUrl}?start=${encodeURIComponent(referralCode)}`;
      welcomeText = `🎁 **Welcome! You were invited to X BOOST!**\n\nReferral Code: \`${referralCode}\`\n\nClick the **🚀 Open X BOOST** button below to complete registration and claim your **৳ 50.00 Welcome Bonus**!`;
    }

    // Check if this Telegram User is new or already has a record
    const userTgId = senderId || String(chatId);
    let dbUser = await getAuthoritativeUser(userTgId);

    // Identify referrer info for the notification
    let referrerDisplayForNotification: string | null = null;
    if (referralCode) {
      const referrerUser = findLocalUser(referralCode);
      if (referrerUser && referrerUser.telegram_id) {
        referrerDisplayForNotification = referrerUser.telegram_id;
      } else {
        referrerDisplayForNotification = referralCode;
      }
    }

    // New User Notification: ONLY ONCE
    // If user does not exist in DB OR hasn't been notified yet:
    const dhakaNow = formatDhakaDateTime(new Date());

    if (!dbUser || !dbUser.new_user_notified) {
      console.log(`[Telegram Webhook]: New user first /start detected for user ${userTgId} (${senderFullName}). Dispatching New User Group notification.`);

      // Send to New User Group
      await sendNewUserNotificationToGroup({
        name: senderFullName,
        chatId: userTgId,
        referral: referrerDisplayForNotification || 'None',
        joinedTime: dhakaNow
      });

      // Save user or update new_user_notified = true
      if (dbUser) {
        dbUser.new_user_notified = true;
        if (!dbUser.first_started_at) {
          dbUser.first_started_at = new Date().toISOString();
        }
        saveLocalUser(dbUser);
        if (serverSupabase) {
          try {
            await serverSupabase
              .from('users')
              .update({
                new_user_notified: true,
                first_started_at: dbUser.first_started_at
              })
              .eq('id', dbUser.id);
          } catch {}
        }
      } else {
        // Create user record in persistent store
        const generatedRefCode = crypto.createHash('md5').update(userTgId).digest('hex').slice(0, 6).toUpperCase();
        const newUser: DbUser = {
          id: `tg_${userTgId}`,
          telegram_id: userTgId,
          first_name: senderFirstName || 'User',
          last_name: senderLastName || null,
          username: senderUsername,
          photo_url: null,
          referrer_id: null,
          referral_code: generatedRefCode,
          balance: 0,
          total_referrals: 0,
          level: 0,
          total_earned: 0,
          total_withdrawn: 0,
          tasks_completed: 0,
          completed_tasks: [],
          daily_ads_watched: 0,
          last_daily_bonus_date: null,
          first_started_at: new Date().toISOString(),
          new_user_notified: true, // Marked as notified so subsequent /start never sends notification again
          created_at: new Date().toISOString()
        };
        saveLocalUser(newUser);
        if (serverSupabase) {
          try {
            await serverSupabase.from('users').insert({
              id: newUser.id,
              telegram_id: newUser.telegram_id,
              first_name: newUser.first_name,
              last_name: newUser.last_name,
              username: newUser.username,
              photo_url: null,
              referrer_id: null,
              referral_code: newUser.referral_code,
              balance: 0,
              total_referrals: 0,
              level: 0,
              total_earned: 0,
              total_withdrawn: 0,
              tasks_completed: 0,
              completed_tasks: [],
              daily_ads_watched: 0,
              first_started_at: newUser.first_started_at,
              new_user_notified: true,
              created_at: newUser.created_at
            });
          } catch {}
        }
      }
    } else {
      console.log(`[Telegram Webhook]: User ${userTgId} already notified (new_user_notified=true). Skipping duplicate New User notification.`);
    }

    // Send Welcome message back to the user in private chat
    if (TELEGRAM_BOT_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Open X BOOST',
                    web_app: { url: webAppUrl }
                  }
                ],
                [
                  {
                    text: '📢 Official Channel',
                    url: 'https://t.me/xboost_comionitiy'
                  }
                ]
              ]
            }
          })
        });
      } catch (err: any) {
        console.error('Error dispatching Telegram message in webhook:', err.message);
      }
    }
  }
  return res.status(200).json({ ok: true });
});

// -------------------------------------------------------------
// Server Lifecycle
// -------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[X BOOST Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Telegram Integration] WebApp URL: ${TELEGRAM_WEBAPP_URL || `http://localhost:${PORT}`}`);
    console.log(`[Telegram Integration] Bot username: @${TELEGRAM_BOT_USERNAME}`);
    console.log(`[Telegram Integration] Withdraw Group: ${TELEGRAM_WITHDRAW_GROUP_ID || 'Not set'}`);
    console.log(`[Telegram Integration] New User Group: ${TELEGRAM_NEW_USER_GROUP_ID || 'Not set'}`);
    console.log(`[Official Channel]: https://t.me/xboost_comionitiy`);
  });
}

// Check if running as main entry point
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('server.ts') || 
  process.argv[1].endsWith('server.js') ||
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);

if (isMainModule) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app, startServer };

