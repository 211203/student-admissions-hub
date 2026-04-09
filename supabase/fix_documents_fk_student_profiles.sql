-- Fix documents.student_id foreign key to reference student_profiles instead of profiles
-- Run this in Supabase SQL editor

DO $$
BEGIN
  -- Drop the existing FK if it exists (name may differ across environments)
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND table_name = 'documents'
      AND constraint_name = 'documents_student_id_fkey'
  ) THEN
    ALTER TABLE public.documents DROP CONSTRAINT documents_student_id_fkey;
  END IF;

  -- Recreate FK to student_profiles
  ALTER TABLE public.documents
    ADD CONSTRAINT documents_student_id_fkey
    FOREIGN KEY (student_id)
    REFERENCES public.student_profiles(id)
    ON DELETE CASCADE;
END $$;
