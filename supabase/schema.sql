-- =============================================================================
-- Supabase / PostgreSQL Production Schema for InstaMeets
-- 100% Idempotent Migration Script (Safe to re-run multiple times)
-- =============================================================================

-- 1. Create Meetings Table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id TEXT NOT NULL UNIQUE,
    host_id TEXT NOT NULL,
    meeting_name TEXT NOT NULL DEFAULT 'Untitled Meeting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by meeting_id
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_id ON public.meetings (meeting_id);


-- 2. Create Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast query of a room's chat history
CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON public.chat_messages (meeting_id, created_at ASC);


-- 3. Create Meeting Whiteboards Persistence Table
-- Stores the latest authoritative collaborative scene state per meeting
CREATE TABLE IF NOT EXISTS public.meeting_whiteboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id TEXT NOT NULL UNIQUE,
    scene_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast query of a room's whiteboard scene
CREATE INDEX IF NOT EXISTS idx_meeting_whiteboards_meeting_id ON public.meeting_whiteboards (meeting_id);


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_whiteboards ENABLE ROW LEVEL SECURITY;


-- 5. Idempotent Row Level Security (RLS) Policies

-- -----------------------------------------------------------------------------
-- Meetings Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on meetings" ON public.meetings;
CREATE POLICY "Allow public read access on meetings"
    ON public.meetings
    FOR SELECT
    TO public, anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow public insert on meetings" ON public.meetings;
CREATE POLICY "Allow public insert on meetings"
    ON public.meetings
    FOR INSERT
    TO public, anon, authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on meetings" ON public.meetings;
CREATE POLICY "Allow public update on meetings"
    ON public.meetings
    FOR UPDATE
    TO public, anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- Chat Messages Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public read access on chat_messages"
    ON public.chat_messages
    FOR SELECT
    TO public, anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow public insert on chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public insert on chat_messages"
    ON public.chat_messages
    FOR INSERT
    TO public, anon, authenticated, service_role
    WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- Meeting Whiteboards Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on meeting_whiteboards" ON public.meeting_whiteboards;
CREATE POLICY "Allow public read access on meeting_whiteboards"
    ON public.meeting_whiteboards
    FOR SELECT
    TO public, anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow public insert/update on meeting_whiteboards" ON public.meeting_whiteboards;
CREATE POLICY "Allow public insert/update on meeting_whiteboards"
    ON public.meeting_whiteboards
    FOR ALL
    TO public, anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);


-- 6. Explicit Table Grants for PostgREST & Supabase Client Roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
