// src/lib/types/index.ts

export type UserRole = "owner" | "admin" | "manager_lead" | "manager" | "creator";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Manager {
  id: string;
  region: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Creator {
  id: string;
  tiktok_id: string;
  username: string;
  email: string | null;
  profile_id: string | null;
  group_id: string | null;
  status: "risk" | "rising" | "close" | "stable";
  created_at: string;
  updated_at: string;
}

export interface CreatorManagerAssignment {
  id: string;
  creator_id: string;
  manager_id: string;
  assigned_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface BackstagePeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

export interface CsvImportFile {
  id: string;
  filename: string;
  storage_path: string;
  period_id: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  errors: any;
  uploaded_by: string | null;
  created_at: string;
}

export interface BackstageRecord {
  id: string;
  import_file_id: string | null;
  period_id: string;
  creator_id: string;
  diamonds: number;
  live_hours: number;
  valid_days: number;
  followers: number;
  matches: number;
  tier_status: string | null;
  graduation_status: string | null;
  last_month_metrics: Record<string, any>;
  growth_metrics: Record<string, any>;
  multi_guest_metrics: Record<string, any>;
  created_at: string;
}

export interface CurrentCreatorState {
  creator_id: string;
  tiktok_id: string;
  username: string;
  creator_email: string | null;
  creator_status: "risk" | "rising" | "close" | "stable";
  group_id: string | null;
  group_name: string | null;
  manager_id: string | null;
  manager_email: string | null;
  manager_name: string | null;
  backstage_record_id: string | null;
  period_id: string | null;
  period_start: string | null;
  period_end: string | null;
  diamonds: number;
  live_hours: number;
  valid_days: number;
  followers: number;
  matches: number;
  tier_status: string | null;
  graduation_status: string | null;
  last_month_metrics: Record<string, any> | null;
  growth_metrics: Record<string, any> | null;
  multi_guest_metrics: Record<string, any> | null;
  last_imported_at: string | null;
}

export interface WeeklyReport {
  id: string;
  period_id: string;
  status: "draft" | "submitted" | "approved";
  summary: Record<string, any>;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  period?: BackstagePeriod;
}

export interface WeeklyReportCreator {
  id: string;
  report_id: string;
  creator_id: string;
  diamonds: number;
  live_hours: number;
  valid_days: number;
  cashback_amount: number;
  status: "risk" | "rising" | "close" | "stable";
  created_at: string;
}

export interface MonthlyCashbackReport {
  id: string;
  month: string;
  status: "draft" | "approved" | "paid";
  total_diamonds: number;
  total_cashback: number;
  manager_breakdown: any[];
  tier_breakdown: Record<string, number>;
  creator_payouts: any[];
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingNote {
  id: string;
  creator_id: string;
  manager_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}
