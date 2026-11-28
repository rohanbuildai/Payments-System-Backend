
-- Up Migration

CREATE TABLE public.merchant_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    absolute_expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    ip_address INET,

    user_agent TEXT,

    CONSTRAINT merchant_sessions_merchant_fk
        FOREIGN KEY (merchant_id)
        REFERENCES public.merchants(id)
        ON DELETE RESTRICT,

    CONSTRAINT merchant_sessions_absolute_expiry_check
        CHECK (absolute_expires_at > created_at)
);


-- Find a merchant's sessions, newest first.
CREATE INDEX merchant_sessions_merchant_created_at_idx
    ON public.merchant_sessions (merchant_id, created_at DESC);


-- Efficiently find sessions that have not been revoked.
CREATE INDEX merchant_sessions_active_idx
    ON public.merchant_sessions (merchant_id, absolute_expires_at)
    WHERE revoked_at IS NULL;


-- Down Migration

DROP TABLE IF EXISTS public.merchant_sessions;
