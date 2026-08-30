-- Migration: 20260830100000_add_ai_shield_system
-- Idempotent, safe for production and Supabase

-- 1. CreateTable public.aishieldsession
CREATE TABLE IF NOT EXISTS public.aishieldsession (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentTimestamp" TIMESTAMP(3),
    "consentVersion" TEXT DEFAULT 'v1.0',
    "consentPurpose" TEXT DEFAULT 'ANTI_CHEATING_PROCTORING',
    "consentMethod" TEXT DEFAULT 'DIGITAL_SIGNATURE_OPT_IN',
    "retentionPolicy" TEXT DEFAULT 'PURGE_AFTER_90_DAYS',
    "dataPurgedAt" TIMESTAMP(3),
    "identityScore" DOUBLE PRECISION,
    "behaviorScore" DOUBLE PRECISION,
    "audioScore" DOUBLE PRECISION,
    "answerIntegrityScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "isHardRuleTriggered" BOOLEAN NOT NULL DEFAULT false,
    "hardRuleReasons" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityConfidence" DOUBLE PRECISION,
    "identityDetails" TEXT,
    "humanReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "reviewerDecision" TEXT,
    "totalFramesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "totalAudioSlicesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "suspiciousEventsCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "recommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "aishieldsession_pkey" PRIMARY KEY ("id")
);

-- 2. CreateTable public.aishieldevent
CREATE TABLE IF NOT EXISTS public.aishieldevent (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aishieldevent_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes for aishieldsession
CREATE INDEX IF NOT EXISTS "aishieldsession_interviewId_idx" ON public.aishieldsession("interviewId");
CREATE INDEX IF NOT EXISTS "aishieldsession_companyId_idx" ON public.aishieldsession("companyId");
CREATE INDEX IF NOT EXISTS "aishieldsession_candidateId_idx" ON public.aishieldsession("candidateId");
CREATE INDEX IF NOT EXISTS "aishieldsession_status_idx" ON public.aishieldsession("status");
CREATE INDEX IF NOT EXISTS "aishieldsession_riskLevel_idx" ON public.aishieldsession("riskLevel");
CREATE INDEX IF NOT EXISTS "aishieldsession_humanReviewStatus_idx" ON public.aishieldsession("humanReviewStatus");

-- 4. Indexes for aishieldevent
CREATE INDEX IF NOT EXISTS "aishieldevent_sessionId_idx" ON public.aishieldevent("sessionId");
CREATE INDEX IF NOT EXISTS "aishieldevent_companyId_idx" ON public.aishieldevent("companyId");
CREATE INDEX IF NOT EXISTS "aishieldevent_eventType_idx" ON public.aishieldevent("eventType");
CREATE INDEX IF NOT EXISTS "aishieldevent_severity_idx" ON public.aishieldevent("severity");

-- 5. Foreign Key Constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'aishieldsession_interviewId_fkey'
    ) THEN
        ALTER TABLE public.aishieldsession 
        ADD CONSTRAINT "aishieldsession_interviewId_fkey" 
        FOREIGN KEY ("interviewId") REFERENCES public.interview("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'aishieldsession_companyId_fkey'
    ) THEN
        ALTER TABLE public.aishieldsession 
        ADD CONSTRAINT "aishieldsession_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES public.company("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'aishieldsession_candidateId_fkey'
    ) THEN
        ALTER TABLE public.aishieldsession 
        ADD CONSTRAINT "aishieldsession_candidateId_fkey" 
        FOREIGN KEY ("candidateId") REFERENCES public.candidate("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'aishieldevent_sessionId_fkey'
    ) THEN
        ALTER TABLE public.aishieldevent 
        ADD CONSTRAINT "aishieldevent_sessionId_fkey" 
        FOREIGN KEY ("sessionId") REFERENCES public.aishieldsession("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
