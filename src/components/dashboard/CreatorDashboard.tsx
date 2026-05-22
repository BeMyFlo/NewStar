"use client";

import React from "react";
import { 
  TrendingUp, 
  Clock, 
  Calendar, 
  Award, 
  DollarSign, 
  Zap, 
  HelpCircle,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrentCreatorState } from "@/lib/types";
import { getTierGap, TIERS } from "@/lib/cashback/engine";

interface CreatorDashboardProps {
  creatorData: CurrentCreatorState;
  userDisplayName: string;
}

export default function CreatorDashboard({
  creatorData,
  userDisplayName
}: CreatorDashboardProps) {
  // Safe default values
  const diamonds = creatorData?.diamonds || 0;
  const liveHours = creatorData?.live_hours || 0;
  const validDays = creatorData?.valid_days || 0;
  const currentTierName = creatorData?.tier_status || "No Tier";

  // Calculate current cashback USD
  const currentTier = TIERS.find(t => t.name === currentTierName);
  const currentCashback = currentTier ? currentTier.cashbackUSD : 0;
  const currentLevel = currentTier ? currentTier.level : 0;

  // Next tier details
  const nextTier = TIERS.find(t => t.level === currentLevel + 1);
  const gap = getTierGap(validDays, liveHours, Number(diamonds));

  // Percentage calculations to next tier targets
  const diamondsPct = nextTier ? Math.min(100, Math.round((Number(diamonds) / nextTier.minDiamonds) * 100)) : 100;
  const hoursPct = nextTier ? Math.min(100, Math.round((liveHours / nextTier.minHours) * 100)) : 100;
  const daysPct = nextTier ? Math.min(100, Math.round((validDays / nextTier.minDays) * 100)) : 100;

  // Generate automated smart coaching tip
  const getSmartCoachingTip = () => {
    if (!nextTier) {
      return "Wow! You have reached Tier 8, the highest possible tier. Keep up the legendary work!";
    }

    const tips = [];
    if (gap.daysNeeded > 0) {
      tips.push(`stream on ${gap.daysNeeded} more day(s)`);
    }
    if (gap.hoursNeeded > 0) {
      tips.push(`broadcast for ${gap.hoursNeeded.toFixed(1)} more hour(s)`);
    }
    if (gap.diamondsNeeded > 0) {
      tips.push(`receive ${gap.diamondsNeeded.toLocaleString()} more diamond(s)`);
    }

    const rewardIncrease = nextTier.cashbackUSD - currentCashback;

    return `You are on your way to ${nextTier.name}! Just ${tips.join(", and ")} to boost your monthly cashback bonus by +$${rewardIncrease} (New total: $${nextTier.cashbackUSD}).`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Creator Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome, {userDisplayName}. Stream, grow, and track your achievements.</p>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Core Stats Card */}
        <div className="md:col-span-2 space-y-6">
          {/* Metrics Overview */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Diamonds</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-white">{(diamonds).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Cumulative monthly diamonds</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Broadcasting Hours</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-white">{liveHours}h</div>
                <p className="text-xs text-muted-foreground">Total streamed hours</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valid Stream Days</CardTitle>
                <Calendar className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-white">{validDays}d</div>
                <p className="text-xs text-muted-foreground">Days streamed &gt; 1 hour</p>
              </CardContent>
            </Card>
          </div>

          {/* Gamification Progress Tracker */}
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" /> Tier Target Progression
              </CardTitle>
              <CardDescription>
                Track your active metrics toward qualified cashback tiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {nextTier ? (
                <div className="space-y-4">
                  {/* Progress bars to next tier */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Diamonds: {(diamonds).toLocaleString()} / {nextTier.minDiamonds.toLocaleString()}</span>
                      <span className="text-zinc-300 font-bold">{diamondsPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${diamondsPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Hours: {liveHours}h / {nextTier.minHours}h</span>
                      <span className="text-zinc-300 font-bold">{hoursPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${hoursPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Days: {validDays}d / {nextTier.minDays}d</span>
                      <span className="text-zinc-300 font-bold">{daysPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${daysPct}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <h3 className="font-bold text-white text-lg">Top Tier 8 Qualified!</h3>
                  <p className="text-sm text-muted-foreground">You have unlocked maximum cashback commissions.</p>
                </div>
              )}

              {/* Dynamic Suggestions Alert */}
              <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500">Smart Coaching Tip</h4>
                  <p className="text-sm text-zinc-300 mt-1 leading-relaxed">
                    {getSmartCoachingTip()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cashback & Payout Detail Card */}
        <div className="space-y-6">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Cashback Status</CardTitle>
              <CardDescription>Estimated commissions for current month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4 bg-zinc-900/50 rounded-lg border border-zinc-900">
                <span className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Current Tier</span>
                <span className="text-2xl font-extrabold text-white block mb-2">{currentTierName}</span>
                <span className="inline-flex items-center text-3xl font-mono font-bold text-emerald-400">
                  <DollarSign className="h-6 w-6" /> {currentCashback}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-2">Payout projected month-end</span>
              </div>

              {/* Tiers Reference Guide */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" /> Cashback Guide
                </h4>
                <div className="text-[11px] space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {TIERS.map(t => (
                    <div 
                      key={t.level}
                      className={`flex justify-between items-center p-2 rounded ${
                        t.name === currentTierName 
                          ? "bg-primary/10 border border-primary/30 text-white font-semibold" 
                          : "bg-zinc-900/20 text-zinc-400 border border-zinc-900"
                      }`}
                    >
                      <div>
                        <p>{t.name} (${t.cashbackUSD})</p>
                        <p className="text-[9px] text-muted-foreground">
                          {t.minDays}d | {t.minHours}h | {t.minDiamonds.toLocaleString()} diamonds
                        </p>
                      </div>
                      {t.level <= currentLevel && (
                        <span className="text-[9px] uppercase font-bold text-emerald-400">Qualified</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
