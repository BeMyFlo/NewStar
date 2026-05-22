// src/app/dashboard/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import OwnerDashboard from "@/components/dashboard/OwnerDashboard";
import ManagerDashboard from "@/components/dashboard/ManagerDashboard";
import CreatorDashboard from "@/components/dashboard/CreatorDashboard";
import { CurrentCreatorState } from "@/lib/types";

export const revalidate = 0; // Disable cache for real-time dashboard data

export default async function DashboardPage() {
  const { user, role, profile, error } = await getServerAuth();

  if (error || !user || !role) {
    redirect("/login");
  }

  const supabaseAdmin = createAdminClient();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";

  // Owner or Admin View
  if (role === "owner" || role === "admin") {
    // 1. Fetch creators state from current_creator_state view
    const { data: creatorsData, error: creatorsError } = await supabaseAdmin
      .from("current_creator_state")
      .select("*");

    if (creatorsError) {
      console.error("Failed to fetch creators state:", creatorsError.message);
    }

    // 2. Fetch periods (for weekly report dropdown)
    const { data: periods, error: periodsError } = await supabaseAdmin
      .from("backstage_periods")
      .select("*")
      .order("end_date", { ascending: false });

    // 3. Fetch weekly reports summaries
    const { data: weeklyReports, error: weeklyError } = await supabaseAdmin
      .from("weekly_reports")
      .select("*")
      .order("created_at", { ascending: false });

    // 4. Fetch monthly cashback reports summaries
    const { data: monthlyReports, error: monthlyError } = await supabaseAdmin
      .from("monthly_cashback_reports")
      .select("*")
      .order("month", { ascending: false });

    return (
      <OwnerDashboard
        creators={(creatorsData as CurrentCreatorState[]) || []}
        periods={periods || []}
        weeklyReports={weeklyReports || []}
        monthlyReports={monthlyReports || []}
        userDisplayName={displayName}
      />
    );
  }

  // Manager or Manager Lead View
  if (role === "manager" || role === "manager_lead") {
    // Fetch creators assigned to this manager (manager_id = user.id)
    const { data: creatorsData, error: creatorsError } = await supabaseAdmin
      .from("current_creator_state")
      .select("*")
      .eq("manager_id", user.id);

    if (creatorsError) {
      console.error("Failed to fetch manager's creators:", creatorsError.message);
    }

    return (
      <ManagerDashboard
        creators={(creatorsData as CurrentCreatorState[]) || []}
        userDisplayName={displayName}
      />
    );
  }

  // Creator View
  if (role === "creator") {
    // 1. First find the creator record referencing the logged-in profile_id
    const { data: creatorRec, error: creatorError } = await supabaseAdmin
      .from("creators")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    let creatorId = creatorRec?.id;

    if (creatorError || !creatorId) {
      // Fallback: If no profile mapping yet, try to search creator by email
      const { data: creatorFallback } = await supabaseAdmin
        .from("creators")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (!creatorFallback) {
        return (
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center space-y-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500">
              User
            </div>
            <h2 className="text-xl font-bold text-white">No Creator Record Found</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your user account is not linked to any TikTok Creator record yet. Please contact your manager or agency owner.
            </p>
          </div>
        );
      }
      
      // Update creator profile_id mapping for future logins
      await supabaseAdmin
        .from("creators")
        .update({ profile_id: user.id })
        .eq("id", creatorFallback.id);
        
      creatorId = creatorFallback.id;
    }

    // 2. Fetch the state from view using creator_id
    const { data: creatorState, error: stateError } = await supabaseAdmin
      .from("current_creator_state")
      .select("*")
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (stateError || !creatorState) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center space-y-4">
          <h2 className="text-xl font-bold text-white">No Data Available</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            We found your creator record, but there is no backstage CSV data imported for you yet.
          </p>
        </div>
      );
    }

    return (
      <CreatorDashboard
        creatorData={creatorState as CurrentCreatorState}
        userDisplayName={displayName}
      />
    );
  }

  // Fallback unauthorized/role error
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center space-y-4">
      <h2 className="text-xl font-bold text-white">Invalid Role Assignment</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your account role "{role}" is not configured for dashboard console access.
      </p>
    </div>
  );
}
