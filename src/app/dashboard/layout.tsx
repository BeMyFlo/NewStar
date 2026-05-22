// src/app/dashboard/layout.tsx
import React from "react";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server-auth";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, profile, error } = await getServerAuth();

  // Route protection server side
  if (error || !user || !role) {
    redirect("/login");
  }

  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <DashboardSidebar role={role} />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header toolbar */}
        <DashboardHeader displayName={displayName} email={user.email || ""} />

        {/* Scrollable Workspace area */}
        <main className="flex-1 overflow-y-auto bg-black p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
