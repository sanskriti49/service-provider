-- Existing tickets are preserved; NULL permits legacy callers without a retry key.
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS client_request_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS support_ticket_client_request_id ON public.support_tickets(client_request_id);
ALTER TABLE public.support_ticket_replies ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.support_ticket_replies ADD COLUMN IF NOT EXISTS client_request_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS support_reply_client_request_id ON public.support_ticket_replies(client_request_id);
