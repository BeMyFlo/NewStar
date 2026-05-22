-- 0007_rls.sql
-- Enable Row Level Security (RLS) and define access policies

-- Helper function to fetch current user's role without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper function to check if current user is owner or admin
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    );
$$;

-- Enable RLS on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backstage_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backstage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_cashback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 1. GROUPS POLICIES
-- ==========================================
CREATE POLICY "Groups are readable by all authenticated users"
    ON public.groups FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Groups are managed by admins and owners only"
    ON public.groups FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 2. PROFILES POLICIES
-- ==========================================
CREATE POLICY "Profiles readable by self, or owners/admins/leads/managers"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id 
        OR public.get_current_user_role() IN ('owner', 'admin', 'manager_lead', 'manager')
    );

CREATE POLICY "Profiles editable by self or admins/owners"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin_or_owner())
    WITH CHECK (auth.uid() = id OR public.is_admin_or_owner());


-- ==========================================
-- 3. MANAGERS POLICIES
-- ==========================================
CREATE POLICY "Managers readable by admins/owners/leads, or self"
    ON public.managers FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id 
        OR public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
    );

CREATE POLICY "Managers managed by admins and owners"
    ON public.managers FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 4. CREATORS POLICIES
-- ==========================================
CREATE POLICY "Creators readable by owners, admins, leads"
    ON public.creators FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
        OR profile_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.creator_manager_assignments 
            WHERE creator_id = creators.id AND manager_id = auth.uid() AND ended_at IS NULL
        )
    );

CREATE POLICY "Creators managed by admins and owners"
    ON public.creators FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 5. ASSIGNMENTS POLICIES
-- ==========================================
CREATE POLICY "Assignments readable by owners, admins, leads, managers, and self creators"
    ON public.creator_manager_assignments FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
        OR manager_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = creator_id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "Assignments managed by admins and owners"
    ON public.creator_manager_assignments FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 6. PERIODS POLICIES
-- ==========================================
CREATE POLICY "Periods readable by all authenticated users"
    ON public.backstage_periods FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Periods managed by admins and owners"
    ON public.backstage_periods FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 7. CSV IMPORT FILES POLICIES
-- ==========================================
CREATE POLICY "CSV imports readable by admins and owners"
    ON public.csv_import_files FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "CSV imports managed by admins and owners"
    ON public.csv_import_files FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 8. BACKSTAGE RECORDS POLICIES
-- ==========================================
CREATE POLICY "Records readable by owners, admins, leads, assigned managers, or self"
    ON public.backstage_records FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
        OR EXISTS (
            SELECT 1 FROM public.creator_manager_assignments 
            WHERE creator_id = backstage_records.creator_id AND manager_id = auth.uid() AND ended_at IS NULL
        )
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = backstage_records.creator_id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "Records managed by admins and owners"
    ON public.backstage_records FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 9. WEEKLY REPORTS POLICIES
-- ==========================================
CREATE POLICY "Weekly reports readable by management roles"
    ON public.weekly_reports FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'admin', 'manager_lead', 'manager'));

CREATE POLICY "Weekly reports managed by admins and owners"
    ON public.weekly_reports FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 10. WEEKLY REPORT CREATORS POLICIES
-- ==========================================
CREATE POLICY "Weekly report creators readable by owners/admins/leads, assigned managers, or self"
    ON public.weekly_report_creators FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
        OR EXISTS (
            SELECT 1 FROM public.creator_manager_assignments 
            WHERE creator_id = weekly_report_creators.creator_id AND manager_id = auth.uid() AND ended_at IS NULL
        )
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = weekly_report_creators.creator_id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "Weekly report creators managed by admins and owners"
    ON public.weekly_report_creators FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 11. MONTHLY CASHBACK REPORTS POLICIES
-- ==========================================
CREATE POLICY "Monthly reports readable by management roles"
    ON public.monthly_cashback_reports FOR SELECT
    TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'admin', 'manager_lead', 'manager'));

CREATE POLICY "Monthly reports managed by admins and owners"
    ON public.monthly_cashback_reports FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());


-- ==========================================
-- 12. COACHING NOTES POLICIES
-- ==========================================
CREATE POLICY "Coaching notes readable by management roles only"
    ON public.coaching_notes FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
        OR manager_id = auth.uid()
    );

CREATE POLICY "Coaching notes insertable by assigned managers or admins/owners"
    ON public.coaching_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin_or_owner()
        OR manager_id = auth.uid()
    );

CREATE POLICY "Coaching notes updates by note creator or admins/owners"
    ON public.coaching_notes FOR UPDATE
    TO authenticated
    USING (manager_id = auth.uid() OR public.is_admin_or_owner())
    WITH CHECK (manager_id = auth.uid() OR public.is_admin_or_owner());

CREATE POLICY "Coaching notes deletion by note creator or admins/owners"
    ON public.coaching_notes FOR DELETE
    TO authenticated
    USING (manager_id = auth.uid() OR public.is_admin_or_owner());


-- ==========================================
-- 13. MESSAGING POLICIES
-- ==========================================
CREATE POLICY "Threads readable by participants, leads, owners, admins"
    ON public.message_threads FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
        -- Manager of the thread
        OR manager_id = auth.uid()
        -- Creator of the thread
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = message_threads.creator_id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "Threads managed by participants, leads, owners, admins"
    ON public.message_threads FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead', 'manager')
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = creator_id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "Messages readable by thread participants, leads, owners, admins"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.message_threads 
            WHERE id = messages.thread_id 
              AND (
                manager_id = auth.uid()
                OR public.get_current_user_role() IN ('owner', 'admin', 'manager_lead')
                OR EXISTS (
                    SELECT 1 FROM public.creators 
                    WHERE id = message_threads.creator_id AND profile_id = auth.uid()
                )
              )
        )
    );

CREATE POLICY "Messages insertable by participants"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.message_threads 
            WHERE id = thread_id 
              AND (
                manager_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.creators 
                    WHERE id = message_threads.creator_id AND profile_id = auth.uid()
                )
              )
        )
    );


-- ==========================================
-- 14. COURSES POLICIES
-- ==========================================
CREATE POLICY "Courses readable by all authenticated users"
    ON public.courses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Courses managed by admins and owners"
    ON public.courses FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "Course completions readable by all management or self profile"
    ON public.course_completions FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead', 'manager')
        OR profile_id = auth.uid()
    );

CREATE POLICY "Course completions managed by self"
    ON public.course_completions FOR ALL
    TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());


-- ==========================================
-- 15. CAMPAIGNS POLICIES
-- ==========================================
CREATE POLICY "Campaigns readable by all authenticated users"
    ON public.campaigns FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Campaigns managed by admins and owners"
    ON public.campaigns FOR ALL
    TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "Participants readable by all management or self creator"
    ON public.campaign_participants FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() IN ('owner', 'admin', 'manager_lead', 'manager')
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = creator_id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "Participants managed by self creator or admins/owners"
    ON public.campaign_participants FOR ALL
    TO authenticated
    USING (
        public.is_admin_or_owner()
        OR EXISTS (
            SELECT 1 FROM public.creators 
            WHERE id = creator_id AND profile_id = auth.uid()
        )
    );


-- ==========================================
-- 16. AUDIT LOG POLICIES
-- ==========================================
CREATE POLICY "Audit logs only readable by owners and admins"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "Audit logs insertable by authenticated users"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true); -- Application server logs events


-- ==========================================
-- 17. AI CONVERSATIONS & MESSAGES POLICIES
-- ==========================================
CREATE POLICY "AI Conversations read/write by owners"
    ON public.ai_conversations FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "AI Messages read/write by conversation owners"
    ON public.ai_messages FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );


-- ==========================================
-- 18. EMAIL EVENTS POLICIES
-- ==========================================
CREATE POLICY "Email events readable by owners and admins"
    ON public.email_events FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner());
