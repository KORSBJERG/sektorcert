DROP POLICY IF EXISTS "Authenticated can read profile rows for shared columns" ON public.profiles;

DELETE FROM public.emergency_plans WHERE customer_id NOT IN (SELECT id FROM public.customers);
DELETE FROM public.nis2_plans WHERE customer_id NOT IN (SELECT id FROM public.customers);
DELETE FROM public.maester_runs WHERE customer_id NOT IN (SELECT id FROM public.customers);
DELETE FROM public.huntress_sync_data WHERE customer_id NOT IN (SELECT id FROM public.customers);
DELETE FROM public.security_reports WHERE customer_id NOT IN (SELECT id FROM public.customers);

DO $$
DECLARE
  r RECORD;
  pairs text[][] := ARRAY[
    ARRAY['assessments','assessments_customer_id_fkey'],
    ARRAY['emergency_plans','emergency_plans_customer_id_fkey'],
    ARRAY['nis2_plans','nis2_plans_customer_id_fkey'],
    ARRAY['maester_runs','maester_runs_customer_id_fkey'],
    ARRAY['huntress_sync_data','huntress_sync_data_customer_id_fkey'],
    ARRAY['security_reports','security_reports_customer_id_fkey']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(pairs,1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = pairs[i][2] AND conrelid = ('public.'||pairs[i][1])::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE',
        pairs[i][1], pairs[i][2]
      );
    ELSE
      -- Ensure existing FK has CASCADE; if not, recreate it
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = pairs[i][2] AND conrelid = ('public.'||pairs[i][1])::regclass
          AND confdeltype = 'c'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', pairs[i][1], pairs[i][2]);
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE',
          pairs[i][1], pairs[i][2]
        );
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own maester reports'
  ) THEN
    CREATE POLICY "Users can delete own maester reports"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'maester-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own security reports'
  ) THEN
    CREATE POLICY "Users can delete own security reports"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'security-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;