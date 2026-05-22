-- 0004_backstage.sql
-- Define periods, imports, raw records, and the main materialized view

-- Create periods table
CREATE TABLE IF NOT EXISTS public.backstage_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_period_range UNIQUE(start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_periods_dates ON public.backstage_periods(start_date, end_date);

-- Create CSV imports log table
CREATE TABLE IF NOT EXISTS public.csv_import_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    period_id UUID REFERENCES public.backstage_periods(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_rows INT DEFAULT 0,
    success_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,
    errors JSONB,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create backstage records table
CREATE TABLE IF NOT EXISTS public.backstage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_file_id UUID REFERENCES public.csv_import_files(id) ON DELETE CASCADE,
    period_id UUID REFERENCES public.backstage_periods(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
    diamonds BIGINT NOT NULL DEFAULT 0,
    live_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valid_days INT NOT NULL DEFAULT 0,
    followers INT NOT NULL DEFAULT 0,
    matches INT NOT NULL DEFAULT 0,
    tier_status TEXT,
    graduation_status TEXT,
    last_month_metrics JSONB,
    growth_metrics JSONB,
    multi_guest_metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_period_creator UNIQUE(period_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_records_period_id ON public.backstage_records(period_id);
CREATE INDEX IF NOT EXISTS idx_records_creator_id ON public.backstage_records(creator_id);

-- Create current creator state materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.current_creator_state AS
WITH latest_records AS (
    SELECT DISTINCT ON (creator_id) 
        r.*
    FROM public.backstage_records r
    JOIN public.backstage_periods p ON r.period_id = p.id
    ORDER BY creator_id, p.end_date DESC, r.created_at DESC
)
SELECT 
    c.id AS creator_id,
    c.tiktok_id,
    c.username,
    c.email AS creator_email,
    c.status AS creator_status,
    g.id AS group_id,
    g.name AS group_name,
    ma.manager_id,
    mp.email AS manager_email,
    mp.display_name AS manager_name,
    r.id AS backstage_record_id,
    r.period_id,
    p.start_date AS period_start,
    p.end_date AS period_end,
    COALESCE(r.diamonds, 0) AS diamonds,
    COALESCE(r.live_hours, 0.0) AS live_hours,
    COALESCE(r.valid_days, 0) AS valid_days,
    COALESCE(r.followers, 0) AS followers,
    COALESCE(r.matches, 0) AS matches,
    r.tier_status,
    r.graduation_status,
    r.last_month_metrics,
    r.growth_metrics,
    r.multi_guest_metrics,
    r.created_at AS last_imported_at
FROM public.creators c
LEFT JOIN latest_records r ON c.id = r.creator_id
LEFT JOIN public.backstage_periods p ON r.period_id = p.id
LEFT JOIN public.groups g ON c.group_id = g.id
LEFT JOIN public.creator_manager_assignments ma ON c.id = ma.creator_id AND ma.ended_at IS NULL
LEFT JOIN public.profiles mp ON ma.manager_id = mp.id;

-- Create a unique index on the materialized view to allow CONCURRENT refreshes
CREATE UNIQUE INDEX IF NOT EXISTS idx_current_creator_state_creator_id ON public.current_creator_state(creator_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_current_creator_state()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.current_creator_state;
END;
$$;

-- Helper to calculate cashback tier and amount based on rules
CREATE OR REPLACE FUNCTION public.calculate_cashback_tier(
    p_days INT,
    p_hours NUMERIC,
    p_diamonds BIGINT
)
RETURNS TABLE (
    tier_level INT,
    tier_name TEXT,
    cashback_amount NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_days >= 22 AND p_hours >= 80 AND p_diamonds >= 3000000 THEN
        RETURN QUERY SELECT 8, 'Tier 8'::TEXT, 850.00;
    ELSIF p_days >= 22 AND p_hours >= 80 AND p_diamonds >= 2000000 THEN
        RETURN QUERY SELECT 7, 'Tier 7'::TEXT, 550.00;
    ELSIF p_days >= 20 AND p_hours >= 80 AND p_diamonds >= 1000000 THEN
        RETURN QUERY SELECT 6, 'Tier 6'::TEXT, 300.00;
    ELSIF p_days >= 18 AND p_hours >= 60 AND p_diamonds >= 750000 THEN
        RETURN QUERY SELECT 5, 'Tier 5'::TEXT, 225.00;
    ELSIF p_days >= 15 AND p_hours >= 40 AND p_diamonds >= 500000 THEN
        RETURN QUERY SELECT 4, 'Tier 4'::TEXT, 150.00;
    ELSIF p_days >= 12 AND p_hours >= 30 AND p_diamonds >= 200000 THEN
        RETURN QUERY SELECT 3, 'Tier 3'::TEXT, 60.00;
    ELSIF p_days >= 10 AND p_hours >= 25 AND p_diamonds >= 200000 THEN
        RETURN QUERY SELECT 2, 'Tier 2'::TEXT, 35.00;
    ELSIF p_days >= 8 AND p_hours >= 20 AND p_diamonds >= 100000 THEN
        RETURN QUERY SELECT 1, 'Tier 1'::TEXT, 20.00;
    ELSE
        RETURN QUERY SELECT 0, 'No Tier'::TEXT, 0.00;
    END IF;
END;
$$;

-- Helper to calculate creator status dynamically (stable, risk, rising, close)
CREATE OR REPLACE FUNCTION public.calculate_creator_status(
    p_days INT,
    p_hours NUMERIC,
    p_diamonds BIGINT,
    p_day_of_month INT,
    p_total_days INT,
    p_last_month_level INT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_factor NUMERIC;
    v_proj_days INT;
    v_proj_hours NUMERIC;
    v_proj_diamonds BIGINT;
    v_current_level INT;
    v_proj_level INT;
    v_progress_ratio NUMERIC;
    -- For next tier
    v_next_min_days INT;
    v_next_min_hours NUMERIC;
    v_next_min_diamonds BIGINT;
BEGIN
    v_factor := p_total_days::NUMERIC / GREATEST(p_day_of_month, 1)::NUMERIC;
    v_proj_days := ROUND(p_days * v_factor);
    v_proj_hours := p_hours * v_factor;
    v_proj_diamonds := ROUND(p_diamonds * v_factor);
    
    -- Current level
    SELECT tier_level INTO v_current_level FROM public.calculate_cashback_tier(p_days, p_hours, p_diamonds);
    -- Projected level
    SELECT tier_level INTO v_proj_level FROM public.calculate_cashback_tier(v_proj_days, v_proj_hours, v_proj_diamonds);
    
    -- 1. RISK Check
    IF p_last_month_level > 0 AND v_proj_level < p_last_month_level THEN
        RETURN 'risk';
    END IF;
    
    v_progress_ratio := p_day_of_month::NUMERIC / p_total_days::NUMERIC;
    IF v_progress_ratio >= 0.3 AND v_proj_level = 0 AND v_current_level = 0 THEN
        RETURN 'risk';
    END IF;
    
    -- 2. CLOSE Check
    IF v_current_level = 0 THEN
        v_next_min_days := 8; v_next_min_hours := 20; v_next_min_diamonds := 100000;
    ELSIF v_current_level = 1 THEN
        v_next_min_days := 10; v_next_min_hours := 25; v_next_min_diamonds := 200000;
    ELSIF v_current_level = 2 THEN
        v_next_min_days := 12; v_next_min_hours := 30; v_next_min_diamonds := 200000;
    ELSIF v_current_level = 3 THEN
        v_next_min_days := 15; v_next_min_hours := 40; v_next_min_diamonds := 500000;
    ELSIF v_current_level = 4 THEN
        v_next_min_days := 18; v_next_min_hours := 60; v_next_min_diamonds := 750000;
    ELSIF v_current_level = 5 THEN
        v_next_min_days := 20; v_next_min_hours := 80; v_next_min_diamonds := 1000000;
    ELSIF v_current_level = 6 THEN
        v_next_min_days := 22; v_next_min_hours := 80; v_next_min_diamonds := 2000000;
    ELSIF v_current_level = 7 THEN
        v_next_min_days := 22; v_next_min_hours := 80; v_next_min_diamonds := 3000000;
    ELSE
        v_next_min_days := 0; v_next_min_hours := 0; v_next_min_diamonds := 0;
    END IF;
    
    IF v_next_min_days > 0 THEN
        IF (p_days::NUMERIC / v_next_min_days::NUMERIC) >= 0.9 
           AND (p_hours::NUMERIC / v_next_min_hours::NUMERIC) >= 0.9
           AND (p_diamonds::NUMERIC / v_next_min_diamonds::NUMERIC) >= 0.9 THEN
            RETURN 'close';
        END IF;
    END IF;
    
    -- 3. RISING Check
    IF p_last_month_level > 0 AND v_proj_level >= p_last_month_level + 2 THEN
        RETURN 'rising';
    END IF;
    
    IF v_proj_level > v_current_level THEN
        RETURN 'rising';
    END IF;
    
    RETURN 'stable';
END;
$$;

-- Main import transactional RPC function
CREATE OR REPLACE FUNCTION public.import_backstage_records(
    p_period_start DATE,
    p_period_end DATE,
    p_import_file_id UUID,
    p_uploaded_by UUID,
    p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period_id UUID;
    v_record JSONB;
    v_creator_id UUID;
    v_manager_id UUID;
    v_group_id UUID;
    v_inserted_count INT := 0;
    v_day_of_month INT;
    v_total_days INT;
    v_last_month_level INT := 0;
    v_status TEXT;
    v_audit_detail JSONB;
BEGIN
    -- 1. Create or get period
    INSERT INTO public.backstage_periods (start_date, end_date)
    VALUES (p_period_start, p_period_end)
    ON CONFLICT (start_date, end_date) DO UPDATE 
    SET updated_at = now()
    RETURNING id INTO v_period_id;

    -- Calculate day of month context for status logic
    v_day_of_month := EXTRACT(DAY FROM p_period_end);
    v_total_days := EXTRACT(DAY FROM (date_trunc('month', p_period_end) + interval '1 month - 1 day')::date);

    -- Loop over records
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        -- 2. Upsert group
        INSERT INTO public.groups (name)
        VALUES (v_record->>'group')
        ON CONFLICT (name) DO UPDATE SET updated_at = now()
        RETURNING id INTO v_group_id;

        -- 3. Upsert manager profile (if not exists)
        SELECT id INTO v_manager_id FROM public.profiles WHERE email = v_record->>'manager_email';
        
        IF v_manager_id IS NULL THEN
            v_manager_id := gen_random_uuid();
            INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, role, aud)
            VALUES (
                v_manager_id,
                v_record->>'manager_email',
                crypt('placeholder_password_not_for_login', gen_salt('bf')),
                '{"provider":"email"}'::jsonb,
                jsonb_build_object('role', 'manager', 'display_name', split_part(v_record->>'manager_email', '@', 1)),
                'authenticated',
                'authenticated'
            );
            
            -- Ensure profile was successfully synchronized and updated
            UPDATE public.profiles 
            SET role = 'manager', display_name = split_part(v_record->>'manager_email', '@', 1)
            WHERE id = v_manager_id;
        END IF;

        -- Ensure managers record exists
        INSERT INTO public.managers (id, region)
        VALUES (v_manager_id, 'Imported Region')
        ON CONFLICT (id) DO NOTHING;

        -- 4. Upsert creator
        SELECT id INTO v_creator_id FROM public.creators WHERE tiktok_id = v_record->>'creator_id';
        
        IF v_creator_id IS NULL THEN
            INSERT INTO public.creators (tiktok_id, username, group_id, status)
            VALUES (
                v_record->>'creator_id',
                v_record->>'username',
                v_group_id,
                'stable'
            )
            RETURNING id INTO v_creator_id;
        ELSE
            UPDATE public.creators
            SET username = v_record->>'username',
                group_id = v_group_id
            WHERE id = v_creator_id;
        END IF;

        -- 5. Upsert active manager assignment
        IF NOT EXISTS (
            SELECT 1 FROM public.creator_manager_assignments 
            WHERE creator_id = v_creator_id AND manager_id = v_manager_id AND ended_at IS NULL
        ) THEN
            UPDATE public.creator_manager_assignments
            SET ended_at = now()
            WHERE creator_id = v_creator_id AND ended_at IS NULL;

            INSERT INTO public.creator_manager_assignments (creator_id, manager_id, assigned_at)
            VALUES (v_creator_id, v_manager_id, now());
        END IF;

        -- Get last month's tier level for status calculation
        SELECT COALESCE(
            (SELECT (calculate_cashback_tier(r.valid_days, r.live_hours, r.diamonds)).tier_level
             FROM public.backstage_records r
             JOIN public.backstage_periods p ON r.period_id = p.id
             WHERE r.creator_id = v_creator_id AND p.end_date < p_period_start
             ORDER BY p.end_date DESC LIMIT 1), 
            0
        ) INTO v_last_month_level;

        -- Calculate current status
        v_status := public.calculate_creator_status(
            (v_record->>'valid_days')::INT,
            (v_record->>'live_hours')::NUMERIC,
            (v_record->>'diamonds')::BIGINT,
            v_day_of_month,
            v_total_days,
            v_last_month_level
        );

        -- Update status on creator
        UPDATE public.creators SET status = v_status WHERE id = v_creator_id;

        -- 6. Insert backstage record
        INSERT INTO public.backstage_records (
            import_file_id,
            period_id,
            creator_id,
            diamonds,
            live_hours,
            valid_days,
            followers,
            matches,
            tier_status,
            graduation_status,
            last_month_metrics,
            growth_metrics,
            multi_guest_metrics
        ) VALUES (
            p_import_file_id,
            v_period_id,
            v_creator_id,
            (v_record->>'diamonds')::BIGINT,
            (v_record->>'live_hours')::NUMERIC,
            (v_record->>'valid_days')::INT,
            (v_record->>'followers')::INT,
            (v_record->>'matches')::INT,
            (v_record->>'tier_status')::TEXT,
            (v_record->>'graduation_status')::TEXT,
            COALESCE(v_record->'last_month_metrics', '{}'::jsonb),
            COALESCE(v_record->'growth_metrics', '{}'::jsonb),
            COALESCE(v_record->'multi_guest_metrics', '{}'::jsonb)
        )
        ON CONFLICT (period_id, creator_id) DO UPDATE SET
            diamonds = EXCLUDED.diamonds,
            live_hours = EXCLUDED.live_hours,
            valid_days = EXCLUDED.valid_days,
            followers = EXCLUDED.followers,
            matches = EXCLUDED.matches,
            tier_status = EXCLUDED.tier_status,
            graduation_status = EXCLUDED.graduation_status,
            last_month_metrics = EXCLUDED.last_month_metrics,
            growth_metrics = EXCLUDED.growth_metrics,
            multi_guest_metrics = EXCLUDED.multi_guest_metrics,
            updated_at = now();

        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    -- 7. Refresh Materialized View
    PERFORM public.refresh_current_creator_state();

    -- 8. Log to audit_log
    v_audit_detail := jsonb_build_object(
        'period_start', p_period_start,
        'period_end', p_period_end,
        'file_id', p_import_file_id,
        'records_count', v_inserted_count
    );
    INSERT INTO public.audit_log (user_id, action, details)
    VALUES (p_uploaded_by, 'IMPORT_BACKSTAGE_CSV', v_audit_detail);

    -- 9. Update import file log status
    UPDATE public.csv_import_files
    SET status = 'completed',
        period_id = v_period_id,
        total_rows = v_inserted_count,
        success_rows = v_inserted_count,
        failed_rows = 0
    WHERE id = p_import_file_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'inserted', v_inserted_count,
        'period_id', v_period_id
    );
EXCEPTION WHEN OTHERS THEN
    -- Fallback status of import file to failed
    UPDATE public.csv_import_files
    SET status = 'failed',
        errors = jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE)
    WHERE id = p_import_file_id;
    
    RAISE;
END;
$$;
