// src/lib/cashback/engine.ts

export interface Tier {
  level: number;
  name: string;
  minDays: number;
  minHours: number;
  minDiamonds: number;
  cashbackUSD: number;
}

export const TIERS: Tier[] = [
  { level: 1, name: "Tier 1", minDays: 8, minHours: 20, minDiamonds: 100000, cashbackUSD: 20 },
  { level: 2, name: "Tier 2", minDays: 10, minHours: 25, minDiamonds: 200000, cashbackUSD: 35 },
  { level: 3, name: "Tier 3", minDays: 12, minHours: 30, minDiamonds: 200000, cashbackUSD: 60 },
  { level: 4, name: "Tier 4", minDays: 15, minHours: 40, minDiamonds: 500000, cashbackUSD: 150 },
  { level: 5, name: "Tier 5", minDays: 18, minHours: 60, minDiamonds: 750000, cashbackUSD: 225 },
  { level: 6, name: "Tier 6", minDays: 20, minHours: 80, minDiamonds: 1000000, cashbackUSD: 300 },
  { level: 7, name: "Tier 7", minDays: 22, minHours: 80, minDiamonds: 2000000, cashbackUSD: 550 },
  { level: 8, name: "Tier 8", minDays: 22, minHours: 80, minDiamonds: 3000000, cashbackUSD: 850 },
];

export interface TierGap {
  nextTierName: string | null;
  daysNeeded: number;
  hoursNeeded: number;
  diamondsNeeded: number;
}

export type CreatorStatus = "risk" | "rising" | "close" | "stable";

/**
 * Returns the highest eligible tier based on days, hours, and diamonds.
 * Creator must satisfy ALL conditions.
 */
export function getCashbackTier(days: number, hours: number, diamonds: number): Tier | null {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const tier = TIERS[i];
    if (days >= tier.minDays && hours >= tier.minHours && diamonds >= tier.minDiamonds) {
      return tier;
    }
  }
  return null;
}

/**
 * Returns the next tier's requirements.
 */
export function getNextTier(currentTierLevel: number): Tier | null {
  const nextIndex = currentTierLevel; // Since levels are 1-indexed and match array position (index = level)
  if (nextIndex < TIERS.length) {
    return TIERS[nextIndex];
  }
  return null;
}

/**
 * Calculates how much more metrics are needed to reach the next tier.
 */
export function getTierGap(days: number, hours: number, diamonds: number): TierGap {
  const currentTier = getCashbackTier(days, hours, diamonds);
  const currentLevel = currentTier ? currentTier.level : 0;
  const nextTier = getNextTier(currentLevel);

  if (!nextTier) {
    return {
      nextTierName: null,
      daysNeeded: 0,
      hoursNeeded: 0,
      diamondsNeeded: 0,
    };
  }

  return {
    nextTierName: nextTier.name,
    daysNeeded: Math.max(0, nextTier.minDays - days),
    hoursNeeded: Math.max(0, nextTier.minHours - hours),
    diamondsNeeded: Math.max(0, nextTier.minDiamonds - diamonds),
  };
}

/**
 * Projects month-end metrics based on current run-rate.
 */
export function projectMonthEndTier(
  currentDays: number,
  currentHours: number,
  currentDiamonds: number,
  dayOfMonth: number,
  totalDaysInMonth: number
): {
  projectedDays: number;
  projectedHours: number;
  projectedDiamonds: number;
  projectedTier: Tier | null;
} {
  const factor = totalDaysInMonth / Math.max(1, dayOfMonth);
  
  const projectedDays = Math.round(currentDays * factor);
  const projectedHours = Math.round((currentHours * factor) * 100) / 100;
  const projectedDiamonds = Math.round(currentDiamonds * factor);
  
  const projectedTier = getCashbackTier(projectedDays, projectedHours, projectedDiamonds);

  return {
    projectedDays,
    projectedHours,
    projectedDiamonds,
    projectedTier,
  };
}

/**
 * Calculates the creator's status based on current run-rate against their target tier.
 * Target tier is either the next tier (if they are close) or their projected month-end tier.
 */
export function calculateCreatorStatus(
  days: number,
  hours: number,
  diamonds: number,
  dayOfMonth: number,
  totalDaysInMonth: number,
  lastMonthTierLevel: number = 0
): CreatorStatus {
  const currentTier = getCashbackTier(days, hours, diamonds);
  const currentLevel = currentTier ? currentTier.level : 0;
  
  const { projectedDays, projectedHours, projectedDiamonds, projectedTier } = 
    projectMonthEndTier(days, hours, diamonds, dayOfMonth, totalDaysInMonth);
    
  const projectedLevel = projectedTier ? projectedTier.level : 0;
  
  // 1. RISK Check:
  // If the projected tier is lower than last month's tier, they are at risk of declining.
  // Or, if the month is at least 30% complete and their current run-rate is not on track to even hit Tier 1.
  const progressRatio = dayOfMonth / totalDaysInMonth;
  if (lastMonthTierLevel > 0 && projectedLevel < lastMonthTierLevel) {
    return "risk";
  }
  if (progressRatio >= 0.3 && projectedLevel === 0 && currentLevel === 0) {
    return "risk";
  }

  // 2. CLOSE Check:
  // If they are not at the maximum tier and are within 10% of the next tier's requirements.
  const nextTier = getNextTier(currentLevel);
  if (nextTier) {
    const gap = getTierGap(days, hours, diamonds);
    
    // Check if remaining requirement for next tier is small
    const daysPct = days / nextTier.minDays;
    const hoursPct = hours / nextTier.minHours;
    const diamondsPct = diamonds / nextTier.minDiamonds;
    
    // If they have achieved at least 90% of all required components for the next tier
    if (daysPct >= 0.9 && hoursPct >= 0.9 && diamondsPct >= 0.9) {
      return "close";
    }
  }

  // 3. RISING Check:
  // If their projected tier is at least 2 levels higher than last month's tier,
  // or if they are exceeding the run-rate of their current level by more than 20%.
  if (lastMonthTierLevel > 0 && projectedLevel >= lastMonthTierLevel + 2) {
    return "rising";
  }
  
  // If they are projecting to hit a higher tier than current level
  if (projectedLevel > currentLevel) {
    return "rising";
  }

  // Default: STABLE
  return "stable";
}
