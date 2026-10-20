-- =========================================================================
-- Migration: Support Tickets, Ticket Replies, and Trust & Safety Reports
-- =========================================================================

-- 1. Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id serial PRIMARY KEY,
    ticket_number varchar(20) UNIQUE NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    name varchar(100) NOT NULL,
    email varchar(150) NOT NULL,
    role varchar(20) DEFAULT 'customer',
    category varchar(50) NOT NULL,
    priority varchar(20) DEFAULT 'normal',
    subject text NOT NULL,
    message text NOT NULL,
    status varchar(20) DEFAULT 'open',
    assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
    resolution_notes text,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolution_notes text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON public.support_tickets(ticket_number);

-- 2. Support Ticket Replies Table
CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
    id serial PRIMARY KEY,
    ticket_id int NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    sender_name varchar(100) NOT NULL,
    sender_role varchar(20) DEFAULT 'customer',
    message text NOT NULL,
    is_internal bool DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.support_ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_internal ON public.support_ticket_replies(ticket_id, is_internal);

-- 3. Chat Reports Column Additions
ALTER TABLE public.chat_reports ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.chat_reports ADD COLUMN IF NOT EXISTS resolution_notes text;
ALTER TABLE public.chat_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.chat_reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_chat_reports_assigned ON public.chat_reports(assigned_to);
CREATE INDEX IF NOT EXISTS ix_chat_reports_status ON public.chat_reports(status);
