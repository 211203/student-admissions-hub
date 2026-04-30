CREATE OR REPLACE VIEW public.pcm_merit_list AS
WITH normalized_applications AS (
  SELECT
    a.student_id,
    COALESCE(
      NULLIF(to_jsonb(a)->>'student_name', ''),
      NULLIF(to_jsonb(a)->>'full_name', ''),
      'Unknown Student'
    ) AS student_name,
    COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(
            NULLIF(to_jsonb(a)->>'total_percentile', ''),
            NULLIF(to_jsonb(a)->>'percentile', ''),
            NULLIF(to_jsonb(a)->>'total_perc', ''),
            ''
          ),
          '[^0-9\\.-]',
          '',
          'g'
        ),
        ''
      )::NUMERIC,
      0
    ) AS total_percentile,
    COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(
            NULLIF(to_jsonb(a)->>'math_percentile', ''),
            NULLIF(to_jsonb(a)->>'maths_percentile', ''),
            NULLIF(to_jsonb(a)->>'math_perc', ''),
            ''
          ),
          '[^0-9\\.-]',
          '',
          'g'
        ),
        ''
      )::NUMERIC,
      0
    ) AS math_percentile,
    COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(
            NULLIF(to_jsonb(a)->>'physics_percentile', ''),
            NULLIF(to_jsonb(a)->>'physics_perc', ''),
            ''
          ),
          '[^0-9\\.-]',
          '',
          'g'
        ),
        ''
      )::NUMERIC,
      0
    ) AS physics_percentile,
    COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(
            NULLIF(to_jsonb(a)->>'chemistry_percentile', ''),
            NULLIF(to_jsonb(a)->>'chemistry_perc', ''),
            ''
          ),
          '[^0-9\\.-]',
          '',
          'g'
        ),
        ''
      )::NUMERIC,
      0
    ) AS chemistry_percentile,
    COALESCE(
      NULLIF(
        regexp_replace(
          COALESCE(
            NULLIF(to_jsonb(a)->>'hsc_aggregate', ''),
            NULLIF(to_jsonb(a)->>'hsc_percentile', ''),
            NULLIF(to_jsonb(a)->>'hsc_percentage', ''),
            ''
          ),
          '[^0-9\\.-]',
          '',
          'g'
        ),
        ''
      )::NUMERIC,
      0
    ) AS hsc_aggregate,
    NULLIF(to_jsonb(a)->>'dob', '')::DATE AS dob,
    LOWER(NULLIF(to_jsonb(a)->>'verification_status', '')) AS verification_status,
    LOWER(NULLIF(to_jsonb(a)->>'status', '')) AS application_status,
    UPPER(
      BTRIM(
        COALESCE(
          NULLIF(to_jsonb(a)->>'academic_stream', ''),
          NULLIF(to_jsonb(a)->>'preferred_stream', '')
        )
      )
    ) AS academic_stream
  FROM public.applications AS a
)
SELECT
  student_id,
  student_name,
  total_percentile,
  math_percentile,
  physics_percentile,
  chemistry_percentile,
  hsc_aggregate,
  dob,
  RANK() OVER (
    ORDER BY
      total_percentile DESC,
      math_percentile DESC,
      physics_percentile DESC,
      chemistry_percentile DESC,
      hsc_aggregate DESC,
      COALESCE(dob, '9999-12-31'::DATE) ASC
  ) AS state_merit_rank
FROM normalized_applications
WHERE (verification_status = 'approved' OR application_status = 'approved')
  AND academic_stream IN ('PCM', 'PCMB');
