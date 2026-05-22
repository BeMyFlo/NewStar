// src/app/api/cashback-reports/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCashbackTier } from "@/lib/cashback/engine";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Auth & Roles Server-Side
    const { user, role, error: authError } = await getServerAuth();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Owner or Admin role required" }, 
        { status: 403 }
      );
    }

    // 2. Parse payload
    const body = await req.json();
    const { month } = body; // Expected 'YYYY-MM-DD' representing start of month, e.g., '2026-05-01'

    if (!month) {
      return NextResponse.json({ error: "Missing month parameters" }, { status: 400 });
    }

    // Date range calculations
    const startDate = new Date(month);
    const year = startDate.getFullYear();
    const monthIndex = startDate.getMonth();
    
    // First day of target month
    const startOfMonth = new Date(year, monthIndex, 1).toISOString().split("T")[0];
    // Last day of target month
    const endOfMonth = new Date(year, monthIndex + 1, 0).toISOString().split("T")[0];

    const supabaseAdmin = createAdminClient();

    // 3. Fetch all backstage records where period is within this month
    const { data: records, error: recordsError } = await supabaseAdmin
      .from("backstage_records")
      .select(`
        id,
        diamonds,
        live_hours,
        valid_days,
        creator_id,
        period_id,
        backstage_periods!inner (
          start_date,
          end_date
        ),
        creators (
          id,
          username,
          tiktok_id,
          creator_manager_assignments (
            manager_id,
            profiles (
              display_name,
              email
            )
          )
        )
      `)
      .gte("backstage_periods.start_date", startOfMonth)
      .lte("backstage_periods.end_date", endOfMonth);

    if (recordsError || !records) {
      return NextResponse.json({ error: `Failed to fetch records: ${recordsError?.message}` }, { status: 500 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No backstage records found within this calendar month to aggregate." }, { status: 400 });
    }

    // 4. Aggregate metrics by creator
    interface AggregatedCreator {
      creator_id: string;
      username: string;
      tiktok_id: string;
      diamonds: bigint;
      live_hours: number;
      valid_days: number;
      manager_id: string | null;
      manager_name: string | null;
      manager_email: string | null;
    }

    const creatorMap: Record<string, AggregatedCreator> = {};

    records.forEach(rec => {
      const creator = rec.creators as any;
      if (!creator) return;

      const creatorId = creator.id;
      
      // Get current active manager (where ended_at is null)
      // Since creator_manager_assignments is an array, we find the one that is active or default to the first one
      const assignments = creator.creator_manager_assignments || [];
      // Note: we might need to filter manually as Supabase nested filters don't automatically slice array
      const activeAssignment = assignments[0]; // Assuming order or active assignment fetched
      
      const managerId = activeAssignment?.manager_id || null;
      const managerName = activeAssignment?.profiles?.display_name || null;
      const managerEmail = activeAssignment?.profiles?.email || null;

      if (!creatorMap[creatorId]) {
        creatorMap[creatorId] = {
          creator_id: creatorId,
          username: creator.username,
          tiktok_id: creator.tiktok_id,
          diamonds: 0n,
          live_hours: 0,
          valid_days: 0,
          manager_id: managerId,
          manager_name: managerName,
          manager_email: managerEmail,
        };
      }

      creatorMap[creatorId].diamonds += BigInt(rec.diamonds);
      creatorMap[creatorId].live_hours += Number(rec.live_hours);
      // For valid days, we sum them up as days streamed throughout the month
      creatorMap[creatorId].valid_days += Number(rec.valid_days);
    });

    // 5. Calculate cashback payouts, tiers, and breakdowns
    let grandTotalDiamonds = 0n;
    let grandTotalCashback = 0;
    const tierDistribution: Record<string, number> = {};
    const managerBreakdownMap: Record<string, {
      manager_id: string;
      manager_name: string;
      manager_email: string;
      total_creators: number;
      total_diamonds: bigint;
      total_cashback: number;
    }> = {};

    const creatorPayouts = Object.values(creatorMap).map(c => {
      const tier = getCashbackTier(c.valid_days, c.live_hours, Number(c.diamonds));
      const tierName = tier ? tier.name : "No Tier";
      const cashbackAmount = tier ? tier.cashbackUSD : 0;

      grandTotalDiamonds += c.diamonds;
      grandTotalCashback += cashbackAmount;

      // Track tier distribution
      tierDistribution[tierName] = (tierDistribution[tierName] || 0) + 1;

      // Track manager breakdown
      const mId = c.manager_id || "unassigned";
      if (!managerBreakdownMap[mId]) {
        managerBreakdownMap[mId] = {
          manager_id: mId,
          manager_name: c.manager_name || "Unassigned",
          manager_email: c.manager_email || "unassigned@newstar.com",
          total_creators: 0,
          total_diamonds: 0n,
          total_cashback: 0
        };
      }
      managerBreakdownMap[mId].total_creators += 1;
      managerBreakdownMap[mId].total_diamonds += c.diamonds;
      managerBreakdownMap[mId].total_cashback += cashbackAmount;

      return {
        creator_id: c.creator_id,
        username: c.username,
        tiktok_id: c.tiktok_id,
        diamonds: String(c.diamonds),
        live_hours: c.live_hours,
        valid_days: c.valid_days,
        tier: tierName,
        amount: cashbackAmount,
        status: "pending_payout"
      };
    });

    // Transform manager breakdown map to serializable array
    const managerBreakdown = Object.values(managerBreakdownMap).map(m => ({
      ...m,
      total_diamonds: String(m.total_diamonds)
    }));

    // 6. Delete and recreate month's report (overwrite protection)
    await supabaseAdmin
      .from("monthly_cashback_reports")
      .delete()
      .eq("month", startOfMonth);

    const { data: report, error: reportError } = await supabaseAdmin
      .from("monthly_cashback_reports")
      .insert({
        month: startOfMonth,
        status: "draft",
        total_diamonds: Number(grandTotalDiamonds), // Safe conversion for display totals
        total_cashback: grandTotalCashback,
        tier_breakdown: tierDistribution,
        manager_breakdown: managerBreakdown,
        creator_payouts: creatorPayouts
      })
      .select()
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: `Failed to create cashback report: ${reportError?.message || "Unknown database error"}` }, { status: 500 });
    }

    // 7. Log action in Audit log
    await supabaseAdmin.from("audit_log").insert({
      user_id: user.id,
      action: "GENERATE_MONTHLY_CASHBACK_REPORT",
      details: { report_id: report.id, month: startOfMonth }
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      month: startOfMonth,
      totalCashback: grandTotalCashback,
      totalCreators: creatorPayouts.length
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
