-- Add the canonical fields queried by the AI Edge Function when a project
-- still has the legacy loan / insurance schema. This migration is additive,
-- preserves the old columns, and does not change RLS or delete financial data.

ALTER TABLE IF EXISTS public.loans
  ADD COLUMN IF NOT EXISTS outstanding numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emi numeric NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.insurance
  ADD COLUMN IF NOT EXISTS coverage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS premium numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='outstanding_amount') THEN
    EXECUTE 'UPDATE public.loans SET outstanding = outstanding_amount WHERE outstanding = 0 AND outstanding_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='emi_amount') THEN
    EXECUTE 'UPDATE public.loans SET emi = emi_amount WHERE emi = 0 AND emi_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='coverage_amount') THEN
    EXECUTE 'UPDATE public.insurance SET coverage = coverage_amount WHERE coverage = 0 AND coverage_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_amount') THEN
    EXECUTE 'UPDATE public.insurance SET premium = premium_amount WHERE premium = 0 AND premium_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_frequency') THEN
    EXECUTE 'UPDATE public.insurance SET frequency = premium_frequency WHERE (frequency IS NULL OR frequency = '''') AND premium_frequency IS NOT NULL';
  END IF;
END $$;

UPDATE public.insurance SET frequency = 'Yearly' WHERE frequency IS NULL OR frequency = '';
ALTER TABLE IF EXISTS public.insurance ALTER COLUMN frequency SET DEFAULT 'Yearly';
ALTER TABLE IF EXISTS public.insurance ALTER COLUMN frequency SET NOT NULL;

NOTIFY pgrst, 'reload schema';
