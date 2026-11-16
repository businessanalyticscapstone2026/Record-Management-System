-- Soft-delete support for OSCA personnel accounts.
-- Deleted accounts remain in the database so historical relationships and
-- audit history are preserved, but they are hidden from account management.
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_user_accounts_not_deleted
  ON public.user_accounts (id)
  WHERE deleted_at IS NULL;
