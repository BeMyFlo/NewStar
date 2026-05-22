// src/lib/auth/server-auth.ts
import { createClient } from "../supabase/server";
import { UserRole } from "../types";

export async function getServerAuth() {
  const supabase = createClient();
  
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(">>> DEBUG GETUSER ERROR:", userError?.message || "User is null");
    return { user: null, role: null, error: "Unauthorized" };
  }

  // Fetch role directly from public.profiles to ensure fresh role validation
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, display_name, group_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user, role: null, error: "Profile not found" };
  }

  return { 
    user, 
    role: profile.role as UserRole, 
    profile: {
      display_name: profile.display_name,
      group_id: profile.group_id,
    },
    error: null 
  };
}
