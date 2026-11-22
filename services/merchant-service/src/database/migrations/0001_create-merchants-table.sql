
-- Up Migration

CREATE TABLE public.merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    business_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,

    email VARCHAR(255) NOT NULL,
    phone VARCHAR(16) NOT NULL,

    business_type VARCHAR(50) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT merchants_business_name_check
        CHECK (LENGTH(TRIM(business_name)) > 0),

    CONSTRAINT merchants_contact_name_check
        CHECK (LENGTH(TRIM(contact_name)) > 0),

    CONSTRAINT merchants_email_check
        CHECK (LENGTH(TRIM(email)) > 0),

    CONSTRAINT merchants_phone_check
        CHECK (phone ~ '^\+[1-9][0-9]{1,14}$'),

    CONSTRAINT merchants_business_type_check
        CHECK (LENGTH(TRIM(business_type)) > 0),

    CONSTRAINT merchants_status_check
        CHECK (
            status IN (
                'PENDING',
                'ACTIVE',
                'SUSPENDED',
                'REJECTED'
            )
        )
);

-- Prevent duplicate emails regardless of letter casing.
CREATE UNIQUE INDEX merchants_email_unique_idx
ON public.merchants (LOWER(email));

-- Helps retrieve merchants by status and creation time.
CREATE INDEX merchants_status_created_at_idx
ON public.merchants (status, created_at);

-- Automatically update updated_at whenever a merchant is modified.
CREATE OR REPLACE FUNCTION public.merchant_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at_trigger
BEFORE UPDATE ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.merchant_set_updated_at();


-- Down Migration

DROP TABLE IF EXISTS public.merchants;

DROP FUNCTION IF EXISTS public.merchant_set_updated_at();
