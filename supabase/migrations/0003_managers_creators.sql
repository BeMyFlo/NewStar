-- 0003_managers_creators.sql
-- Define manager and creator business entities

-- Create managers table extending profiles
CREATE TABLE IF NOT EXISTS public.managers (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    region TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create creators table
CREATE TABLE IF NOT EXISTS public.creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tiktok_id TEXT UNIQUE NOT NULL, -- Corresponds to creator_id from CSV
    username TEXT NOT NULL,
    email TEXT UNIQUE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Link if creator has app login
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'stable' CHECK (status IN ('risk', 'rising', 'close', 'stable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creators_tiktok_id ON public.creators(tiktok_id);
CREATE INDEX IF NOT EXISTS idx_creators_group_id ON public.creators(group_id);
CREATE INDEX IF NOT EXISTS idx_creators_profile_id ON public.creators(profile_id);

-- Create creator manager assignments table
CREATE TABLE IF NOT EXISTS public.creator_manager_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_creator ON public.creator_manager_assignments(creator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_manager ON public.creator_manager_assignments(manager_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active ON public.creator_manager_assignments(creator_id, manager_id) WHERE ended_at IS NULL;
