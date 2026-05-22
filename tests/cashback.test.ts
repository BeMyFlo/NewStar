// tests/cashback.test.ts
import { describe, it, expect } from "vitest";
import { 
  getCashbackTier, 
  getTierGap, 
  projectMonthEndTier, 
  calculateCreatorStatus,
  TIERS
} from "../src/lib/cashback/engine";

describe("Cashback Engine - getCashbackTier", () => {
  it("should return null for metrics below Tier 1 requirements", () => {
    // Tier 1 needs 8 days, 20 hours, 100,000 diamonds
    expect(getCashbackTier(7, 25, 200000)).toBeNull();
    expect(getCashbackTier(9, 19, 200000)).toBeNull();
    expect(getCashbackTier(9, 25, 99000)).toBeNull();
  });

  it("should calculate exact Tier 1 eligibility", () => {
    const tier = getCashbackTier(8, 20, 100000);
    expect(tier).not.toBeNull();
    expect(tier?.level).toBe(1);
    expect(tier?.cashbackUSD).toBe(20);
  });

  it("should calculate Tier 3 eligibility when meeting all criteria", () => {
    // Tier 3 needs: 12 days, 30 hours, 200,000 diamonds
    const tier = getCashbackTier(12, 30, 200000);
    expect(tier?.level).toBe(3);
    expect(tier?.cashbackUSD).toBe(60);
  });

  it("should drop to lower tier if one condition is not met", () => {
    // Metrics meet Tier 5 for diamonds (800k > 750k) and days (18 = 18), 
    // but hours is 59 (Tier 5 requires 60, Tier 4 requires 40)
    // So it should fall back to Tier 4
    const tier = getCashbackTier(18, 59, 800000);
    expect(tier?.level).toBe(4);
    expect(tier?.cashbackUSD).toBe(150);
  });
});

describe("Cashback Engine - getTierGap", () => {
  it("should return correct gap to reach the next tier", () => {
    // Current: 8 days, 20 hours, 100k diamonds (Tier 1)
    // Next Tier (Tier 2): 10 days, 25 hours, 200k diamonds
    const gap = getTierGap(8, 20, 100000);
    expect(gap.nextTierName).toBe("Tier 2");
    expect(gap.daysNeeded).toBe(2);
    expect(gap.hoursNeeded).toBe(5);
    expect(gap.diamondsNeeded).toBe(100000);
  });

  it("should return zero gaps for the maximum tier", () => {
    // Tier 8: 22 days, 80 hours, 3,000,000 diamonds
    const gap = getTierGap(23, 85, 3100000);
    expect(gap.nextTierName).toBeNull();
    expect(gap.daysNeeded).toBe(0);
    expect(gap.hoursNeeded).toBe(0);
    expect(gap.diamondsNeeded).toBe(0);
  });
});

describe("Cashback Engine - projectMonthEndTier", () => {
  it("should project month-end metrics accurately", () => {
    // Day 15 of 30 (50% progress). Achievement: 5 days, 10 hours, 50k diamonds
    // Projected should double: 10 days, 20 hours, 100k diamonds
    const projection = projectMonthEndTier(5, 10, 50000, 15, 30);
    expect(projection.projectedDays).toBe(10);
    expect(projection.projectedHours).toBe(20);
    expect(projection.projectedDiamonds).toBe(100000);
    expect(projection.projectedTier?.level).toBe(1); // Meets Tier 1 (8 days, 20 hours, 100k)
  });
});

describe("Cashback Engine - calculateCreatorStatus", () => {
  it("should return risk if projection declines compared to last month", () => {
    // Last month: Tier 3. Current day 15 of 30, only has 4 days, 8 hours, 50k diamonds.
    // Projected is 8 days, 16 hours, 100k diamonds (Meets Tier 1, but below last month's Tier 3)
    const status = calculateCreatorStatus(4, 8, 50000, 15, 30, 3);
    expect(status).toBe("risk");
  });

  it("should return close if within 10% of next tier targets", () => {
    // Tier 2 needs: 10 days, 25 hours, 200k.
    // Current: 9.5 days, 24 hours, 195k (All values >= 90% of Tier 2 target)
    // Under day 30 of 30 (end of month)
    const status = calculateCreatorStatus(9.5, 24, 195000, 30, 30, 1);
    expect(status).toBe("close");
  });

  it("should return rising if projected to climb at least 2 tiers from last month", () => {
    // Last month: Tier 1
    // Day 10 of 30 (33% progress). Current: 6 days, 15 hours, 250k.
    // Projected: 18 days, 45 hours, 750k -> Meets Tier 4 (climbing 3 levels)
    const status = calculateCreatorStatus(6, 15, 250000, 10, 30, 1);
    expect(status).toBe("rising");
  });

  it("should return stable if on track for their current tier level", () => {
    // Current: 10 days, 25 hours, 200k (Tier 2).
    // Day 30 of 30. Projected: 10 days, 25 hours, 200k (Meets Tier 2, matches last month's Tier 2)
    const status = calculateCreatorStatus(10, 25, 200000, 30, 30, 2);
    expect(status).toBe("stable");
  });
});
