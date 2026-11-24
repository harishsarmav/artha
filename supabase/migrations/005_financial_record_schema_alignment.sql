-- Additive alignment for existing DhanView financial tables.
-- Existing rows are preserved. Legacy values are copied only when a known
-- legacy column exists, and no missing financial amounts are fabricated.

BEGIN;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS frequency text;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS frequency text;

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS monthly_amount numeric,
  ADD COLUMN IF NOT EXISTS invested_amount numeric,
  ADD COLUMN IF NOT EXISTS current_value numeric,
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS outstanding numeric,
  ADD COLUMN IF NOT EXISTS emi numeric,
  ADD COLUMN IF NOT EXISTS interest_rate numeric,
  ADD COLUMN IF NOT EXISTS tenure_months integer;

ALTER TABLE public.insurance
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS coverage numeric,
  ADD COLUMN IF NOT EXISTS premium numeric,
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS renewal_date date;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS target_amount numeric,
  ADD COLUMN IF NOT EXISTS current_amount numeric,
  ADD COLUMN IF NOT EXISTS target_date date;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS source text;

DO $$
BEGIN
  -- Preserve values where a legacy and canonical column both exist.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='source') THEN
    EXECUTE $sql$UPDATE public.income SET name=source WHERE (name IS NULL OR name='') AND source IS NOT NULL$sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='description') THEN
    EXECUTE $sql$UPDATE public.income SET type=description WHERE (type IS NULL OR type='') AND description IS NOT NULL$sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='income_amount') THEN
    EXECUTE 'UPDATE public.income SET amount=income_amount WHERE amount IS NULL AND income_amount IS NOT NULL';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='monthly_amount') THEN
    EXECUTE 'UPDATE public.income SET amount=monthly_amount WHERE amount IS NULL AND monthly_amount IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='description') THEN
    EXECUTE $sql$UPDATE public.expenses SET name=description WHERE (name IS NULL OR name='') AND description IS NOT NULL$sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='expense_amount') THEN
    EXECUTE 'UPDATE public.expenses SET amount=expense_amount WHERE amount IS NULL AND expense_amount IS NOT NULL';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='monthly_amount') THEN
    EXECUTE 'UPDATE public.expenses SET amount=monthly_amount WHERE amount IS NULL AND monthly_amount IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='fund_name') THEN
    EXECUTE $sql$UPDATE public.investments SET name=fund_name WHERE (name IS NULL OR name='') AND fund_name IS NOT NULL$sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='contribution_type') THEN
    EXECUTE $sql$UPDATE public.investments SET mode=contribution_type WHERE (mode IS NULL OR mode='') AND contribution_type IS NOT NULL$sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='description') THEN
    EXECUTE $sql$UPDATE public.loans SET name=description WHERE (name IS NULL OR name='') AND description IS NOT NULL$sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='outstanding_amount') THEN
    EXECUTE 'UPDATE public.loans SET outstanding=outstanding_amount WHERE outstanding IS NULL AND outstanding_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='emi_amount') THEN
    EXECUTE 'UPDATE public.loans SET emi=emi_amount WHERE emi IS NULL AND emi_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='remaining_months') THEN
    EXECUTE 'UPDATE public.loans SET tenure_months=remaining_months WHERE tenure_months IS NULL AND remaining_months IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='coverage_amount') THEN
    EXECUTE 'UPDATE public.insurance SET coverage=coverage_amount WHERE coverage IS NULL AND coverage_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_amount') THEN
    EXECUTE 'UPDATE public.insurance SET premium=premium_amount WHERE premium IS NULL AND premium_amount IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_frequency') THEN
    EXECUTE $sql$UPDATE public.insurance SET frequency=premium_frequency WHERE (frequency IS NULL OR frequency='') AND premium_frequency IS NOT NULL$sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='goals' AND column_name='type') THEN
    EXECUTE $sql$UPDATE public.goals SET name=type WHERE (name IS NULL OR name='') AND type IS NOT NULL$sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='date') THEN
    EXECUTE 'UPDATE public.transactions SET transaction_date=date WHERE transaction_date IS NULL AND date IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='type') THEN
    EXECUTE $sql$UPDATE public.transactions SET transaction_type=type WHERE (transaction_type IS NULL OR transaction_type='') AND type IS NOT NULL$sql$;
  END IF;
END $$;

-- Older versions required legacy-only fields that the current forms do not
-- submit. Keep those columns and values, but allow them to be null going forward.
DO $$
DECLARE legacy record;
BEGIN
  FOR legacy IN
    SELECT * FROM (VALUES
      ('income','source'), ('income','description'),
      ('expenses','description'), ('expenses','is_essential'),
      ('investments','contribution_type'),
      ('loans','description'), ('loans','outstanding_amount'), ('loans','emi_amount'), ('loans','remaining_months'),
      ('insurance','coverage_amount'), ('insurance','premium_amount'), ('insurance','premium_frequency'),
      ('goals','type')
    ) AS fields(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=legacy.table_name AND column_name=legacy.column_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', legacy.table_name, legacy.column_name);
    END IF;
  END LOOP;
END $$;

-- The app always sends income amount; this default only supports legacy rows
-- inserted by older clients that omit the field.
ALTER TABLE public.income ALTER COLUMN name SET DEFAULT 'Income';
ALTER TABLE public.income ALTER COLUMN type SET DEFAULT 'Other';
ALTER TABLE public.income ALTER COLUMN frequency SET DEFAULT 'Monthly';
ALTER TABLE public.expenses ALTER COLUMN name SET DEFAULT 'Expense';
ALTER TABLE public.expenses ALTER COLUMN category SET DEFAULT 'Other';
ALTER TABLE public.expenses ALTER COLUMN frequency SET DEFAULT 'Monthly';

NOTIFY pgrst, 'reload schema';

COMMIT;
