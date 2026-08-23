-- CreateTable public.interviewslot
CREATE TABLE IF NOT EXISTS public.interviewslot (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviewslot_pkey" PRIMARY KEY ("id")
);

-- CreateTable public.schedulingsession
CREATE TABLE IF NOT EXISTS public.schedulingsession (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT,
    "interviewerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "interviewType" TEXT NOT NULL DEFAULT 'VIDEO',
    "duration" INTEGER NOT NULL DEFAULT 45,
    "location" TEXT,
    "meetingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedulingsession_pkey" PRIMARY KEY ("id")
);

-- CreateTable public.calendarintegration
CREATE TABLE IF NOT EXISTS public.calendarintegration (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "calendarId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendarintegration_pkey" PRIMARY KEY ("id")
);

-- AlterTable public.interview: Add new fields non-destructively
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "interviewerId" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "startTime" TIMESTAMP(3);
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "endTime" TIMESTAMP(3);
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Asia/Riyadh';
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "meetingUrl" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "phoneInfo" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "schedulingSessionId" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "rescheduledFromId" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "rescheduledAt" TIMESTAMP(3);
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "reminder24hSent" BOOLEAN DEFAULT false;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "reminder1hSent" BOOLEAN DEFAULT false;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT;
ALTER TABLE public.interview ADD COLUMN IF NOT EXISTS "calendarSyncStatus" TEXT DEFAULT 'PENDING';

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "interviewslot_companyId_idx" ON public.interviewslot("companyId");
CREATE INDEX IF NOT EXISTS "interviewslot_userId_date_idx" ON public.interviewslot("userId", "date");
CREATE INDEX IF NOT EXISTS "interviewslot_startTime_endTime_idx" ON public.interviewslot("startTime", "endTime");

CREATE UNIQUE INDEX IF NOT EXISTS "schedulingsession_tokenHash_key" ON public.schedulingsession("tokenHash");
CREATE INDEX IF NOT EXISTS "schedulingsession_companyId_idx" ON public.schedulingsession("companyId");
CREATE INDEX IF NOT EXISTS "schedulingsession_candidateId_idx" ON public.schedulingsession("candidateId");
CREATE INDEX IF NOT EXISTS "schedulingsession_status_idx" ON public.schedulingsession("status");

CREATE UNIQUE INDEX IF NOT EXISTS "calendarintegration_companyId_userId_provider_key" ON public.calendarintegration("companyId", "userId", "provider");
CREATE INDEX IF NOT EXISTS "calendarintegration_companyId_idx" ON public.calendarintegration("companyId");

CREATE INDEX IF NOT EXISTS "interview_companyId_idx" ON public.interview("companyId");
CREATE INDEX IF NOT EXISTS "interview_interviewerId_idx" ON public.interview("interviewerId");
CREATE INDEX IF NOT EXISTS "interview_startTime_endTime_idx" ON public.interview("startTime", "endTime");
CREATE INDEX IF NOT EXISTS "interview_status_idx" ON public.interview("status");

-- AddForeignKeys
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviewslot_companyId_fkey') THEN
        ALTER TABLE public.interviewslot ADD CONSTRAINT "interviewslot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.company("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviewslot_userId_fkey') THEN
        ALTER TABLE public.interviewslot ADD CONSTRAINT "interviewslot_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.user("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedulingsession_companyId_fkey') THEN
        ALTER TABLE public.schedulingsession ADD CONSTRAINT "schedulingsession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.company("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedulingsession_candidateId_fkey') THEN
        ALTER TABLE public.schedulingsession ADD CONSTRAINT "schedulingsession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES public.candidate("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedulingsession_interviewerId_fkey') THEN
        ALTER TABLE public.schedulingsession ADD CONSTRAINT "schedulingsession_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES public.user("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendarintegration_companyId_fkey') THEN
        ALTER TABLE public.calendarintegration ADD CONSTRAINT "calendarintegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.company("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendarintegration_userId_fkey') THEN
        ALTER TABLE public.calendarintegration ADD CONSTRAINT "calendarintegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.user("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_companyId_fkey') THEN
        ALTER TABLE public.interview ADD CONSTRAINT "interview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.company("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_interviewerId_fkey') THEN
        ALTER TABLE public.interview ADD CONSTRAINT "interview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES public.user("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
