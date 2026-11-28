
-- Up Migration

CREATE TABLE public.merchant_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL,

    token_hash CHAR(64) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    consumed_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    replaced_by_token_id UUID,

    CONSTRAINT merchant_refresh_tokens_session_fk
        FOREIGN KEY (session_id)
        REFERENCES public.merchant_sessions(id)
        ON DELETE RESTRICT,

    CONSTRAINT merchant_refresh_tokens_hash_unique
        UNIQUE (token_hash),

    CONSTRAINT merchant_refresh_tokens_hash_format_check
        CHECK (token_hash ~ '^[a-f0-9]{64}$'),

    CONSTRAINT merchant_refresh_tokens_expiry_check
        CHECK (expires_at > created_at),

    -- Required to enforce that replacement tokens belong
    -- to the same session.
    CONSTRAINT merchant_refresh_tokens_id_session_unique
        UNIQUE (id, session_id),

    CONSTRAINT merchant_refresh_tokens_replacement_fk
        FOREIGN KEY (replaced_by_token_id, session_id)
        REFERENCES public.merchant_refresh_tokens(id, session_id)
        ON DELETE RESTRICT,

    CONSTRAINT merchant_refresh_tokens_no_self_replacement_check
        CHECK (
            replaced_by_token_id IS NULL
            OR replaced_by_token_id <> id
        ),

    CONSTRAINT merchant_refresh_tokens_replacement_consumed_check
        CHECK (
            replaced_by_token_id IS NULL
            OR consumed_at IS NOT NULL
        )
);


-- Find refresh-token history for a session.
CREATE INDEX merchant_refresh_tokens_session_created_at_idx
    ON public.merchant_refresh_tokens (session_id, created_at DESC);


-- Quickly find the currently usable refresh token for a session.
CREATE INDEX merchant_refresh_tokens_active_idx
    ON public.merchant_refresh_tokens (session_id, expires_at)
    WHERE consumed_at IS NULL
      AND revoked_at IS NULL;


-- A replacement token must not be linked to multiple old tokens.
CREATE UNIQUE INDEX merchant_refresh_tokens_replaced_by_unique_idx
    ON public.merchant_refresh_tokens (replaced_by_token_id)
    WHERE replaced_by_token_id IS NOT NULL;


-- Down Migration

DROP TABLE IF EXISTS public.merchant_refresh_tokens;