-- =============================================================================
-- Supabase / PostgreSQL Schema for InstaMeets (Idempotent Migration Script)
-- Can be safely re-run multiple times without errors
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

-- Meetings Policies
DROP POLICY IF EXISTS "Allow public read access on meetings" ON public.meetings;
CREATE POLICY "Allow public read access on meetings"
    ON public.meetings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert on meetings" ON public.meetings;
CREATE POLICY "Allow public insert on meetings"
    ON public.meetings FOR INSERT
    WITH CHECK (true);

-- Chat Messages Policies
DROP POLICY IF EXISTS "Allow public read access on chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public read access on chat_messages"
    ON public.chat_messages FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert on chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public insert on chat_messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (true);

-- Meeting Whiteboards Policies
DROP POLICY IF EXISTS "Allow public read access on meeting_whiteboards" ON public.meeting_whiteboards;
CREATE POLICY "Allow public read access on meeting_whiteboards"
    ON public.meeting_whiteboards FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert/update on meeting_whiteboards" ON public.meeting_whiteboards;
CREATE POLICY "Allow public insert/update on meeting_whiteboards"
    ON public.meeting_whiteboards FOR ALL
    USING (true)
    WITH CHECK (true);
