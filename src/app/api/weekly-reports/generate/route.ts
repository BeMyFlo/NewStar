// src/app/api/weekly-reports/generate/route.ts
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
    const { periodId } = body;

    if (!periodId) {
      return NextResponse.json({ error: "Missing periodId" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 3. Fetch period details
    const { data: period, error: periodError } = await supabaseAdmin
      .from("backstage_periods")
      .select("*")
      .eq("id", periodId)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: `Period not found: ${periodError?.message}` }, { status: 404 });
    }

    // 4. Fetch all backstage records for this period
    // We join with creators to get their status & info
    const { data: records, error: recordsError } = await supabaseAdmin
      .from("backstage_records")
      .select(`
        *,
        creators (
          id,
          username,
          tiktok_id,
          status
        )
      `)
      .eq("period_id", periodId);

    if (recordsError || !records || records.length === 0) {
      return NextResponse.json({ error: "No backstage data found for this period to generate report." }, { status: 400 });
    }

    // 5. Create draft weekly report
    // Delete existing one if exists to allow regeneration (overwrite/re-run protection)
    await supabaseAdmin
      .from("weekly_reports")
      .delete()
      .eq("period_id", periodId);

    const { data: report, error: reportError } = await supabaseAdmin
      .from("weekly_reports")
      .insert({
        period_id: periodId,
        status: "draft",
        summary: {}
      })
      .select()
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: `Failed to create weekly report log: ${reportError?.message || "Unknown database error"}` }, { status: 500 });
    }

    let totalDiamonds = 0n;
    let totalCashback = 0;
    let creatorCount = records.length;
    let creatorsAtRisk = 0;
    const tierCounts: Record<string, number> = {};

    // 6. Map and insert details into weekly_report_creators
    const detailsToInsert = records.map(rec => {
      const diamonds = BigInt(rec.diamonds);
      const hours = Number(rec.live_hours);
      const days = Number(rec.valid_days);

      // Compute cashback amount using Cashback Engine helper
      const calculatedTier = getCashbackTier(days, hours, Number(diamonds));
      const cashbackAmount = calculatedTier ? calculatedTier.cashbackUSD : 0;
      const tierName = calculatedTier ? calculatedTier.name : "No Tier";

      // Track status
      const currentStatus = rec.creators?.status || "stable";
      if (currentStatus === "risk") {
        creatorsAtRisk++;
      }

      // Aggregate network stats
      totalDiamonds += diamonds;
      totalCashback += cashbackAmount;
      tierCounts[tierName] = (tierCounts[tierName] || 0) + 1;

      return {
        report_id: report.id,
        creator_id: rec.creator_id,
        diamonds: Number(diamonds), // Safe to convert down for display/reports in JSON/DB
        live_hours: hours,
        valid_days: days,
        cashback_amount: cashbackAmount,
        status: currentStatus,
      };
    });

    const { error: insertDetailsError } = await supabaseAdmin
      .from("weekly_report_creators")
      .insert(detailsToInsert);

    if (insertDetailsError) {
      // Rollback weekly report
      await supabaseAdmin.from("weekly_reports").delete().eq("id", report.id);
      return NextResponse.json({ error: `Failed to write creator snapshot details: ${insertDetailsError.message}` }, { status: 500 });
    }

    // 7. Update report with summary metrics
    const summary = {
      total_diamonds: String(totalDiamonds), // JSON doesn't support bigints directly
      total_cashback: totalCashback,
      creator_count: creatorCount,
      creators_at_risk: creatorsAtRisk,
      tier_distribution: tierCounts,
      generated_by: user.id,
      generated_at: new Date().toISOString()
    };

    const { error: updateSummaryError } = await supabaseAdmin
      .from("weekly_reports")
      .update({ summary })
      .eq("id", report.id);

    if (updateSummaryError) {
      return NextResponse.json({ error: `Failed to finalize summary: ${updateSummaryError.message}` }, { status: 500 });
    }

    // 8. Log action in Audit log
    await supabaseAdmin.from("audit_log").insert({
      user_id: user.id,
      action: "GENERATE_WEEKLY_REPORT",
      details: { report_id: report.id, period_id: periodId }
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      summary
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
