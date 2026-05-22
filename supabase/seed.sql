-- supabase/seed.sql
-- Seed database with test users, groups, managers, creators, and assignments

-- Enable pgcrypto in auth schema if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA pg_catalog;

-- Create default groups
INSERT INTO public.groups (id, name) VALUES
  ('a0a80101-0000-0000-0000-000000000001', 'Vietnam LIVE Network'),
  ('a0a80101-0000-0000-0000-000000000002', 'Thailand Rising Stars'),
  ('a0a80101-0000-0000-0000-000000000003', 'Indonesia Creator Hub')
ON CONFLICT (name) DO NOTHING;

-- Seed auth users (Password is 'password123')
-- We use fixed UUIDs so they can be referenced subsequently
INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    is_super_admin, 
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone_change_token,
    email_change
) VALUES
  (
    'c0a80101-0000-0000-0000-000000000001', 
    '00000000-0000-0000-0000-000000000000', 
    'owner@newstar.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"role":"owner","display_name":"Owner Alice"}', 
    false, 
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    'c0a80101-0000-0000-0000-000000000002', 
    '00000000-0000-0000-0000-000000000000', 
    'admin@newstar.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"role":"admin","display_name":"Admin Bob"}', 
    false, 
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    'c0a80101-0000-0000-0000-000000000003', 
    '00000000-0000-0000-0000-000000000000', 
    'lead@newstar.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"role":"manager_lead","display_name":"Lead Charlie"}', 
    false, 
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    'c0a80101-0000-0000-0000-000000000004', 
    '00000000-0000-0000-0000-000000000000', 
    'manager1@newstar.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"role":"manager","display_name":"Manager Dave"}', 
    false, 
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    'c0a80101-0000-0000-0000-000000000005', 
    '00000000-0000-0000-0000-000000000000', 
    'manager2@newstar.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"role":"manager","display_name":"Manager Emma"}', 
    false, 
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    'c0a80101-0000-0000-0000-000000000006', 
    '00000000-0000-0000-0000-000000000000', 
    'creator1@newstar.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"role":"creator","display_name":"Creator Frank"}', 
    false, 
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- Since auth.users INSERT trigger auto-inserts into public.profiles:
-- Let's associate profiles with groups where needed
UPDATE public.profiles 
SET group_id = 'a0a80101-0000-0000-0000-000000000001'
WHERE role IN ('manager_lead', 'manager', 'creator');

-- Fill managers table
INSERT INTO public.managers (id, region, phone) VALUES
  ('c0a80101-0000-0000-0000-000000000003', 'Southeast Asia', '+84900000001'),
  ('c0a80101-0000-0000-0000-000000000004', 'Vietnam', '+84900000002'),
  ('c0a80101-0000-0000-0000-000000000005', 'Thailand', '+66800000003')
ON CONFLICT (id) DO NOTHING;

-- Seed creators
INSERT INTO public.creators (id, tiktok_id, username, email, profile_id, group_id, status) VALUES
  -- Creator Frank (has a profile app login)
  ('e0a80101-0000-0000-0000-000000000001', 'frank_live', 'Creator Frank', 'creator1@newstar.com', 'c0a80101-0000-0000-0000-000000000006', 'a0a80101-0000-0000-0000-000000000001', 'stable'),
  -- Other TikTok creators (without app profile yet, just records)
  ('e0a80101-0000-0000-0000-000000000002', 'jack_stream', 'Jack Streamer', 'jack@gmail.com', NULL, 'a0a80101-0000-0000-0000-000000000001', 'rising'),
  ('e0a80101-0000-0000-0000-000000000003', 'rose_beauty', 'Rose Beauty', 'rose@gmail.com', NULL, 'a0a80101-0000-0000-0000-000000000001', 'close'),
  ('e0a80101-0000-0000-0000-000000000004', 'lisa_dance', 'Lisa Dancer', 'lisa@gmail.com', NULL, 'a0a80101-0000-0000-0000-000000000002', 'risk'),
  ('e0a80101-0000-0000-0000-000000000005', 'tom_gaming', 'Tom Gaming', 'tom@gmail.com', NULL, 'a0a80101-0000-0000-0000-000000000003', 'stable')
ON CONFLICT (tiktok_id) DO NOTHING;

-- Seed Creator Manager Assignments
INSERT INTO public.creator_manager_assignments (creator_id, manager_id, assigned_at) VALUES
  ('e0a80101-0000-0000-0000-000000000001', 'c0a80101-0000-0000-0000-000000000004', now() - INTERVAL '30 days'),
  ('e0a80101-0000-0000-0000-000000000002', 'c0a80101-0000-0000-0000-000000000004', now() - INTERVAL '20 days'),
  ('e0a80101-0000-0000-0000-000000000003', 'c0a80101-0000-0000-0000-000000000004', now() - INTERVAL '15 days'),
  ('e0a80101-0000-0000-0000-000000000004', 'c0a80101-0000-0000-0000-000000000005', now() - INTERVAL '10 days'),
  ('e0a80101-0000-0000-0000-000000000005', 'c0a80101-0000-0000-0000-000000000005', now() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- Create default backstage periods
INSERT INTO public.backstage_periods (id, start_date, end_date, status) VALUES
  ('d0a80101-0000-0000-0000-000000000001', '2026-05-01', '2026-05-07', 'closed'),
  ('d0a80101-0000-0000-0000-000000000002', '2026-05-08', '2026-05-14', 'closed'),
  ('d0a80101-0000-0000-0000-000000000003', '2026-05-15', '2026-05-21', 'open')
ON CONFLICT DO NOTHING;

-- Create dummy backstage records for completed weeks
INSERT INTO public.backstage_records (
    period_id, 
    creator_id, 
    diamonds, 
    live_hours, 
    valid_days, 
    followers, 
    matches,
    tier_status
) VALUES
  -- Period 1: May 1 to May 7
  ('d0a80101-0000-0000-0000-000000000001', 'e0a80101-0000-0000-0000-000000000001', 120000, 22.5, 9, 2300, 15, 'Tier 1'),
  ('d0a80101-0000-0000-0000-000000000001', 'e0a80101-0000-0000-0000-000000000002', 300000, 28.0, 11, 4500, 28, 'Tier 2'),
  ('d0a80101-0000-0000-0000-000000000001', 'e0a80101-0000-0000-0000-000000000003', 190000, 24.5, 9, 1200, 8, 'Tier 1'), -- missed tier 2 due to diamonds & hours
  ('d0a80101-0000-0000-0000-000000000001', 'e0a80101-0000-0000-0000-000000000004', 50000, 12.0, 5, 800, 2, 'No Tier'),
  ('d0a80101-0000-0000-0000-000000000001', 'e0a80101-0000-0000-0000-000000000005', 600000, 42.0, 16, 7600, 42, 'Tier 4'),
  
  -- Period 2: May 8 to May 14
  ('d0a80101-0000-0000-0000-000000000002', 'e0a80101-0000-0000-0000-000000000001', 250000, 26.0, 12, 2450, 18, 'Tier 2'),
  ('d0a80101-0000-0000-0000-000000000002', 'e0a80101-0000-0000-0000-000000000002', 450000, 38.0, 14, 4900, 35, 'Tier 3'),
  ('d0a80101-0000-0000-0000-000000000002', 'e0a80101-0000-0000-0000-000000000003', 210000, 25.5, 10, 1350, 10, 'Tier 2'),
  ('d0a80101-0000-0000-0000-000000000002', 'e0a80101-0000-0000-0000-000000000004', 85000, 18.5, 7, 950, 4, 'No Tier'),
  ('d0a80101-0000-0000-0000-000000000002', 'e0a80101-0000-0000-0000-000000000005', 800000, 62.0, 19, 8100, 50, 'Tier 5')
ON CONFLICT (period_id, creator_id) DO NOTHING;

-- Refresh materialized view to parse seeded data
SELECT public.refresh_current_creator_state();
