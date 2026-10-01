export type UserLevel = 0 | 1 | 2 | 3 | 4 | 5 | 'VIP';

export interface LevelDetails {
  level: UserLevel;
  levelDisplay: string;
  dailyReward: number;
  totalReferrals: number;
  minReferralsForCurrentLevel: number;
  nextLevelReferrals: number | null;
  neededForNextLevel: number;
  progressPercent: number;
  nextLevelName: string | null;
}

export function calculateUserLevel(totalRealReferrals: number): LevelDetails {
  const referrals = Math.max(0, Math.floor(Number(totalRealReferrals) || 0));

  if (referrals < 40) {
    return {
      level: 0,
      levelDisplay: 'LV0',
      dailyReward: 5,
      totalReferrals: referrals,
      minReferralsForCurrentLevel: 0,
      nextLevelReferrals: 40,
      neededForNextLevel: 40 - referrals,
      progressPercent: Math.min(100, Math.round((referrals / 40) * 100)),
      nextLevelName: 'LV1'
    };
  }

  if (referrals >= 40 && referrals < 80) {
    return {
      level: 1,
      levelDisplay: 'LV1',
      dailyReward: 10,
      totalReferrals: referrals,
      minReferralsForCurrentLevel: 40,
      nextLevelReferrals: 80,
      neededForNextLevel: 80 - referrals,
      progressPercent: Math.min(100, Math.round(((referrals - 40) / 40) * 100)),
      nextLevelName: 'LV2'
    };
  }

  if (referrals >= 80 && referrals < 120) {
    return {
      level: 2,
      levelDisplay: 'LV2',
      dailyReward: 20,
      totalReferrals: referrals,
      minReferralsForCurrentLevel: 80,
      nextLevelReferrals: 120,
      neededForNextLevel: 120 - referrals,
      progressPercent: Math.min(100, Math.round(((referrals - 80) / 40) * 100)),
      nextLevelName: 'LV3'
    };
  }

  if (referrals >= 120 && referrals < 180) {
    return {
      level: 3,
      levelDisplay: 'LV3',
      dailyReward: 30,
      totalReferrals: referrals,
      minReferralsForCurrentLevel: 120,
      nextLevelReferrals: 180,
      neededForNextLevel: 180 - referrals,
      progressPercent: Math.min(100, Math.round(((referrals - 120) / 60) * 100)),
      nextLevelName: 'LV4'
    };
  }

  if (referrals >= 180 && referrals < 240) {
    return {
      level: 4,
      levelDisplay: 'LV4',
      dailyReward: 40,
      totalReferrals: referrals,
      minReferralsForCurrentLevel: 180,
      nextLevelReferrals: 240,
      neededForNextLevel: 240 - referrals,
      progressPercent: Math.min(100, Math.round(((referrals - 180) / 60) * 100)),
      nextLevelName: 'LV5'
    };
  }

  if (referrals >= 240 && referrals < 300) {
    return {
      level: 5,
      levelDisplay: 'LV5',
      dailyReward: 50,
      totalReferrals: referrals,
      minReferralsForCurrentLevel: 240,
      nextLevelReferrals: 300,
      neededForNextLevel: 300 - referrals,
      progressPercent: Math.min(100, Math.round(((referrals - 240) / 60) * 100)),
      nextLevelName: 'VIP Members'
    };
  }

  return {
    level: 'VIP',
    levelDisplay: 'VIP',
    dailyReward: 80,
    totalReferrals: referrals,
    minReferralsForCurrentLevel: 300,
    nextLevelReferrals: null,
    neededForNextLevel: 0,
    progressPercent: 100,
    nextLevelName: null
  };
}
