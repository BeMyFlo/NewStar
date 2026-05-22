"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  FileText, 
  Users, 
  Settings, 
  GraduationCap, 
  BookOpen, 
  Flag 
} from "lucide-react";
import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
}

export default function DashboardSidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  // Define navigation items based on User Role
  const getNavItems = () => {
    const common = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }
    ];

    if (role === "owner" || role === "admin") {
      return [
        ...common,
        { name: "Weekly Reports", href: "/dashboard?tab=weekly", icon: FileText },
        { name: "Cashback Payouts", href: "/dashboard?tab=cashback", icon: FileSpreadsheet },
        { name: "Audit Logs", href: "/dashboard?tab=audit", icon: Settings },
      ];
    }

    if (role === "manager" || role === "manager_lead") {
      return [
        ...common,
        { name: "Coaching Notes", href: "/dashboard?tab=coaching", icon: BookOpen },
        { name: "Creators Roster", href: "/dashboard?tab=roster", icon: Users },
      ];
    }

    // For Creator
    return [
      ...common,
      { name: "Cashback Guide", href: "/dashboard?tab=guide", icon: GraduationCap },
      { name: "My Campaigns", href: "/dashboard?tab=campaigns", icon: Flag }
    ];
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col h-screen sticky top-0">
      {/* Brand logo */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-900">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm font-serif">N</span>
          </div>
          <span className="text-white font-bold tracking-wider text-base">NEWSTAR</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          // In a simple tab-based dashboard, checking query params or active pathname
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? "bg-primary text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-zinc-900">
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-900">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold">Logged in as</p>
          <p className="text-xs font-semibold text-zinc-300 capitalize mt-0.5">{role.replace("_", " ")}</p>
        </div>
      </div>
    </aside>
  );
}
