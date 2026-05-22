-- 0005_reports.sql
-- Define weekly reports and monthly cashback reports tables

-- Weekly reports overview table
CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID REFERENCES public.backstage_periods(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_weekly_report_period UNIQUE(period_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_period ON public.weekly_reports(period_id);

-- Weekly report creator details table
CREATE TABLE IF NOT EXISTS public.weekly_report_creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.weekly_reports(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
    diamonds BIGINT NOT NULL DEFAULT 0,
    live_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valid_days INT NOT NULL DEFAULT 0,
    cashback_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('risk', 'rising', 'close', 'stable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_report_creator UNIQUE(report_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_wrc_report_id ON public.weekly_report_creators(report_id);
CREATE INDEX IF NOT EXISTS idx_wrc_creator_id ON public.weekly_report_creators(creator_id);

-- Monthly cashback reports table
CREATE TABLE IF NOT EXISTS public.monthly_cashback_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NOT NULL, -- Date representing the month, e.g. '2026-05-01'
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    total_diamonds BIGINT NOT NULL DEFAULT 0,
    total_cashback NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    manager_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { manager_id, manager_email, manager_name, total_creators, total_diamonds, total_cashback }
    tier_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- Map of { tierName: count }
    creator_payouts JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { creator_id, username, tiktok_id, diamonds, live_hours, valid_days, tier, amount, status }
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_monthly_cashback UNIQUE(month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_cashback_month ON public.monthly_cashback_reports(month);
