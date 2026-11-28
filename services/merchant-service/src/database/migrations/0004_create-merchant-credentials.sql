
-- Up Migration

CREATE TABLE public.merchant_credentials (
    merchant_id UUID PRIMARY KEY,

    password_hash VARCHAR(255) NOT NULL,

    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT merchant_credentials_merchant_fk
        FOREIGN KEY (merchant_id)
        REFERENCES public.merchants(id)
        ON DELETE RESTRICT,

    CONSTRAINT merchant_credentials_password_hash_nonempty_check
        CHECK (LENGTH(TRIM(password_hash)) > 0)
);

CREATE TRIGGER merchant_credentials_updated_at_trigger
    BEFORE UPDATE ON public.merchant_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.merchant_set_updated_at();


-- Down Migration

DROP TABLE IF EXISTS public.merchant_credentials;
