
-- Up Migration

CREATE TABLE public.merchant_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL,

    key_prefix VARCHAR(32) NOT NULL,
    secret_hash CHAR(64) NOT NULL,

    environment VARCHAR(10) NOT NULL DEFAULT 'TEST',
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,

    CONSTRAINT merchant_api_keys_merchant_fk
        FOREIGN KEY (merchant_id)
        REFERENCES public.merchants(id)
        ON DELETE RESTRICT,

    CONSTRAINT merchant_api_keys_prefix_unique
        UNIQUE (key_prefix),

    CONSTRAINT merchant_api_keys_prefix_check
        CHECK (LENGTH(TRIM(key_prefix)) > 0),

    CONSTRAINT merchant_api_keys_hash_check
        CHECK (secret_hash ~ '^[a-f0-9]{64}$'),

    CONSTRAINT merchant_api_keys_environment_check
        CHECK (environment IN ('TEST', 'LIVE')),

    CONSTRAINT merchant_api_keys_status_check
        CHECK (status IN ('ACTIVE', 'REVOKED')),

    CONSTRAINT merchant_api_keys_expiration_check
        CHECK (expires_at IS NULL OR expires_at > created_at),

    CONSTRAINT merchant_api_keys_revocation_check
        CHECK (
            (status = 'ACTIVE' AND revoked_at IS NULL)
            OR
            (status = 'REVOKED' AND revoked_at IS NOT NULL)
        )
);

CREATE INDEX merchant_api_keys_merchant_id_idx
ON public.merchant_api_keys (merchant_id);

CREATE INDEX merchant_api_keys_merchant_environment_idx
ON public.merchant_api_keys (merchant_id, environment);


-- Down Migration

DROP TABLE IF EXISTS public.merchant_api_keys;
