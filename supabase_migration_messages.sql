-- ==============================================================================
-- MIGRATION: Real-Time Messaging System
-- Run in Supabase Dashboard → SQL Editor
-- ==============================================================================

-- 1. Create conversations table (each unique pair of users has one conversation)
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Conversation participants (exactly 2 per conversation)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id  UUID  NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

-- 3. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body             TEXT        NOT NULL,
  is_read          BOOLEAN     DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);

-- 5. Enable RLS
ALTER TABLE public.conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                  ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: users can only see conversations they participate in
CREATE POLICY "participants can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "participants can view their memberships"
  ON public.conversation_participants FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "participants can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "participants can mark messages read"
  ON public.messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- Admins can create conversations (INSERT on all 3 tables)
CREATE POLICY "admins can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "admins can add participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR user_id = auth.uid()
  );

-- 7. Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
