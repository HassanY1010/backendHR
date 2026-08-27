-- Migration: 20260827180000_add_interview_evaluation_system
-- Idempotent, safe for production and Supabase

-- 1. CreateTable public.interviewevaluation
CREATE TABLE IF NOT EXISTS public.interviewevaluation (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredBy" TEXT,
    "triggerSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "overallScore" DOUBLE PRECISION,
    "recommendation" TEXT NOT NULL DEFAULT 'PENDING',
    "technicalScore" DOUBLE PRECISION,
    "technicalDetail" TEXT,
    "communicationScore" DOUBLE PRECISION,
    "communicationDetail" TEXT,
    "experienceScore" DOUBLE PRECISION,
    "experienceDetail" TEXT,
    "problemSolvingScore" DOUBLE PRECISION,
    "problemSolvingDetail" TEXT,
    "cultureFitScore" DOUBLE PRECISION,
    "cultureFitDetail" TEXT,
    "scoringWeights" TEXT,
    "aiSummary" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "riskFactors" TEXT,
    "rejectionReasons" TEXT,
    "transcriptSnapshot" TEXT,
    "transcriptSource" TEXT,
    "transcriptLanguage" TEXT,
    "jobRequirementsSnapshot" TEXT,
    "cvSummarySnapshot" TEXT,
    "biasCheckPassed" BOOLEAN NOT NULL DEFAULT true,
    "evaluatedAttributes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "aiModel" TEXT,
    "promptVersion" TEXT DEFAULT 'v2',
    "rawAiResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviewevaluation_pkey" PRIMARY KEY ("id")
);

-- 2. CreateTable public.interviewevaluationversion
CREATE TABLE IF NOT EXISTS public.interviewevaluationversion (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT,

    CONSTRAINT "interviewevaluationversion_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes for interviewevaluation
CREATE INDEX IF NOT EXISTS "interviewevaluation_interviewId_idx" ON public.interviewevaluation("interviewId");
CREATE INDEX IF NOT EXISTS "interviewevaluation_companyId_idx" ON public.interviewevaluation("companyId");
CREATE INDEX IF NOT EXISTS "interviewevaluation_candidateId_idx" ON public.interviewevaluation("candidateId");
CREATE INDEX IF NOT EXISTS "interviewevaluation_isActive_idx" ON public.interviewevaluation("isActive");
CREATE INDEX IF NOT EXISTS "interviewevaluation_status_idx" ON public.interviewevaluation("status");
CREATE INDEX IF NOT EXISTS "interviewevaluation_recommendation_idx" ON public.interviewevaluation("recommendation");
CREATE INDEX IF NOT EXISTS "interviewevaluation_overallScore_idx" ON public.interviewevaluation("overallScore");

-- 4. Database-level partial unique index: enforce MAX ONE active evaluation per interview
CREATE UNIQUE INDEX IF NOT EXISTS "interviewevaluation_one_active_per_interview" 
ON public.interviewevaluation("interviewId") 
WHERE "isActive" = true;

-- 5. Indexes for interviewevaluationversion
CREATE INDEX IF NOT EXISTS "interviewevaluationversion_evaluationId_idx" ON public.interviewevaluationversion("evaluationId");
CREATE INDEX IF NOT EXISTS "interviewevaluationversion_interviewId_idx" ON public.interviewevaluationversion("interviewId");
CREATE INDEX IF NOT EXISTS "interviewevaluationversion_companyId_idx" ON public.interviewevaluationversion("companyId");

-- 6. Add Foreign Keys safely
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviewevaluation_interviewId_fkey') THEN
        ALTER TABLE public.interviewevaluation 
        ADD CONSTRAINT "interviewevaluation_interviewId_fkey" 
        FOREIGN KEY ("interviewId") REFERENCES public.interview("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviewevaluationversion_evaluationId_fkey') THEN
        ALTER TABLE public.interviewevaluationversion 
        ADD CONSTRAINT "interviewevaluationversion_evaluationId_fkey" 
        FOREIGN KEY ("evaluationId") REFERENCES public.interviewevaluation("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
