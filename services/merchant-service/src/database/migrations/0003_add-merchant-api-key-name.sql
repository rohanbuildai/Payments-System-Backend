
-- Up Migration

-- 1. Add the name column as nullable initially.
ALTER TABLE public.merchant_api_keys
ADD COLUMN name VARCHAR(100);

-- 2. Backfill existing API keys.
UPDATE public.merchant_api_keys
SET name = 'Unnamed key'
WHERE name IS NULL;

-- 3. Enforce NOT NULL after backfilling.
ALTER TABLE public.merchant_api_keys
ALTER COLUMN name SET NOT NULL;

-- 4. Prevent empty or whitespace-only names.
ALTER TABLE public.merchant_api_keys
ADD CONSTRAINT merchant_api_keys_name_check
CHECK (LENGTH(TRIM(name)) > 0);


-- Down Migration

ALTER TABLE public.merchant_api_keys
DROP CONSTRAINT IF EXISTS merchant_api_keys_name_check;

ALTER TABLE public.merchant_api_keys
DROP COLUMN IF EXISTS name;
