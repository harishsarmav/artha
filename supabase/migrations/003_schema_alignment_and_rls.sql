-- Artha v0.6 schema alignment and RLS reset.
-- This migration does not export or print financial rows. It renames legacy
-- columns only when the canonical column is absent, and backfills when both exist.
-- Take a Supabase backup before applying to an existing project.

DO $$
BEGIN
  -- Profiles: old releases used user_id/full_name; v0.6 uses id/name.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id') THEN
    ALTER TABLE public.profiles RENAME COLUMN user_id TO id;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id') THEN
    UPDATE public.profiles SET id = user_id WHERE user_id IS NOT NULL AND id IS DISTINCT FROM user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='name') THEN
    ALTER TABLE public.profiles RENAME COLUMN full_name TO name;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='name') THEN
    UPDATE public.profiles SET name = full_name WHERE (name IS NULL OR name = '') AND full_name IS NOT NULL;
  END IF;

  -- Income: source/description -> name/type.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='source')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='name') THEN
    ALTER TABLE public.income RENAME COLUMN source TO name;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='source')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='name') THEN
    UPDATE public.income SET name = source WHERE (name IS NULL OR name IN ('', 'Income')) AND source IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='description')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='type') THEN
    ALTER TABLE public.income RENAME COLUMN description TO type;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='description')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='income' AND column_name='type') THEN
    UPDATE public.income SET type = description WHERE (type IS NULL OR type IN ('', 'Other')) AND description IS NOT NULL;
  END IF;

  -- Expenses: description -> name.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='description')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='name') THEN
    ALTER TABLE public.expenses RENAME COLUMN description TO name;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='description')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='name') THEN
    UPDATE public.expenses SET name = description WHERE (name IS NULL OR name IN ('', 'Expense', 'Loan')) AND description IS NOT NULL;
  END IF;

  -- Investments: contribution_type -> mode.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='contribution_type')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='mode') THEN
    ALTER TABLE public.investments RENAME COLUMN contribution_type TO mode;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='contribution_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='investments' AND column_name='mode') THEN
    UPDATE public.investments SET mode = contribution_type WHERE (mode IS NULL OR mode IN ('', 'Lump sum')) AND contribution_type IS NOT NULL;
  END IF;

  -- Loans: legacy description/outstanding_amount/emi_amount -> v0.6 fields.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='description')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='name') THEN
    ALTER TABLE public.loans RENAME COLUMN description TO name;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='description')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='name') THEN
    UPDATE public.loans SET name = description WHERE (name IS NULL OR name IN ('', 'Loan')) AND description IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='outstanding_amount')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='outstanding') THEN
    ALTER TABLE public.loans RENAME COLUMN outstanding_amount TO outstanding;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='outstanding_amount')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='outstanding') THEN
    UPDATE public.loans SET outstanding = outstanding_amount WHERE (outstanding IS NULL OR outstanding = 0) AND outstanding_amount IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='emi_amount')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='emi') THEN
    ALTER TABLE public.loans RENAME COLUMN emi_amount TO emi;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='emi_amount')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='emi') THEN
    UPDATE public.loans SET emi = emi_amount WHERE (emi IS NULL OR emi = 0) AND emi_amount IS NOT NULL;
  END IF;

  -- Insurance: legacy coverage_amount/premium_amount/premium_frequency -> v0.6 fields.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='coverage_amount')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='coverage') THEN
    ALTER TABLE public.insurance RENAME COLUMN coverage_amount TO coverage;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='coverage_amount')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='coverage') THEN
    UPDATE public.insurance SET coverage = coverage_amount WHERE (coverage IS NULL OR coverage = 0) AND coverage_amount IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_amount')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium') THEN
    ALTER TABLE public.insurance RENAME COLUMN premium_amount TO premium;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_amount')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium') THEN
    UPDATE public.insurance SET premium = premium_amount WHERE (premium IS NULL OR premium = 0) AND premium_amount IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_frequency')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='frequency') THEN
    ALTER TABLE public.insurance RENAME COLUMN premium_frequency TO frequency;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='premium_frequency')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='insurance' AND column_name='frequency') THEN
    UPDATE public.insurance SET frequency = premium_frequency WHERE (frequency IS NULL OR frequency IN ('', 'Yearly')) AND premium_frequency IS NOT NULL;
  END IF;
END $$;


-- If both legacy and canonical fields exist, allow new clients to write only
-- canonical fields while preserving the old values for rollback/audit.
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      ('profiles','full_name'),
      ('income','source'), ('income','description'),
      ('expenses','description'), ('expenses','is_essential'),
      ('investments','contribution_type'),
      ('loans','description'), ('loans','outstanding_amount'), ('loans','emi_amount'), ('loans','remaining_months'),
      ('insurance','coverage_amount'), ('insurance','premium_amount'), ('insurance','premium_frequency'),\n      ('goals','type')
    ) AS legacy(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=v.table_name AND column_name=v.column_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', v.table_name, v.column_name);
    END IF;
  END LOOP;
END $$;

-- Some legacy databases have both profiles.id and a NOT NULL profiles.user_id.
-- Keep both synchronized for inserts while the app uses the canonical id column.
CREATE OR REPLACE FUNCTION public.sync_profile_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.id IS NULL THEN NEW.id := NEW.user_id; END IF;
  IF NEW.user_id IS NULL THEN NEW.user_id := NEW.id; END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id') THEN
    DROP TRIGGER IF EXISTS profiles_sync_identity ON public.profiles;
    CREATE TRIGGER profiles_sync_identity
      BEFORE INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_identity();
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_id_uidx ON public.profiles(id);
  ELSE
    DROP TRIGGER IF EXISTS profiles_sync_identity ON public.profiles;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_identity() FROM PUBLIC, anon, authenticated;

-- Ensure new signups create the canonical profiles(id, name) row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Rebuild policies for Artha's user-owned tables to eliminate stale permissive policies.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['profiles','income','expenses','investments','loans','insurance','goals','transactions','ai_usage'])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE TO authenticated USING ((SELECT auth.uid()) = id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['income','expenses','investments','loans','insurance','goals','transactions'] LOOP
    EXECUTE format('CREATE POLICY %I_select_own ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)', t, t);
    EXECUTE format('CREATE POLICY %I_insert_own ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)', t, t);
    EXECUTE format('CREATE POLICY %I_update_own ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', t, t);
    EXECUTE format('CREATE POLICY %I_delete_own ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id)', t, t);
  END LOOP;
END $$;

CREATE POLICY ai_usage_select_own ON public.ai_usage
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.profiles, public.income, public.expenses, public.investments,
  public.loans, public.insurance, public.goals, public.transactions, public.ai_usage FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles, public.income, public.expenses,
  public.investments, public.loans, public.insurance, public.goals, public.transactions TO authenticated;
REVOKE ALL ON TABLE public.ai_usage FROM authenticated;
GRANT SELECT ON TABLE public.ai_usage TO authenticated;
