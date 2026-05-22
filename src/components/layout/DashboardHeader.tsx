"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, Bell } from "lucide-react";

interface HeaderProps {
  displayName: string;
  email: string;
}

export default function DashboardHeader({ displayName, email }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center space-x-4">
        {/* Mobile menu toggle placeholder */}
        <button className="text-zinc-400 hover:text-white md:hidden cursor-pointer">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-zinc-400 text-sm hidden md:inline-block">NewStar Management Console</span>
      </div>

      <div className="flex items-center space-x-4">
        {/* Notifications placeholder */}
        <button className="text-zinc-400 hover:text-white relative cursor-pointer">
          <Bell className="h-4 w-4" />
          <span className="absolute top-0 right-0 h-1.5 w-1.5 bg-primary rounded-full" />
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-3 border-l border-zinc-800 pl-4">
          <div className="flex flex-col text-right">
            <span className="text-sm font-semibold text-white">{displayName || email}</span>
            <span className="text-[10px] text-zinc-500">{email}</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
            <User className="h-4 w-4" />
          </div>
          
          <Button 
            onClick={handleSignOut}
            disabled={loggingOut}
            variant="ghost" 
            size="icon" 
            className="text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
