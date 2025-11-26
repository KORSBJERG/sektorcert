-- Add version tracking to assessments
ALTER TABLE public.assessments 
ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN parent_assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_assessments_parent ON public.assessments(parent_assessment_id);

-- Add comment
COMMENT ON COLUMN public.assessments.version IS 'Version number of the assessment';
COMMENT ON COLUMN public.assessments.parent_assessment_id IS 'Reference to the original assessment if this is a version';