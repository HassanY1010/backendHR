-- CreateTable public.aijobdescription
CREATE TABLE IF NOT EXISTS public.aijobdescription (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobRequestId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "generatedContent" JSONB NOT NULL,
    "marketAnalysis" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aijobdescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "aijobdescription_companyId_jobTitle_version_key" ON public.aijobdescription("companyId", "jobTitle", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "aijobdescription_companyId_idx" ON public.aijobdescription("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "aijobdescription_jobRequestId_idx" ON public.aijobdescription("jobRequestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "aijobdescription_createdBy_idx" ON public.aijobdescription("createdBy");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aijobdescription_companyId_fkey') THEN
        ALTER TABLE public.aijobdescription ADD CONSTRAINT "aijobdescription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.company("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aijobdescription_createdBy_fkey') THEN
        ALTER TABLE public.aijobdescription ADD CONSTRAINT "aijobdescription_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.user("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aijobdescription_jobRequestId_fkey') THEN
        ALTER TABLE public.aijobdescription ADD CONSTRAINT "aijobdescription_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES public.jobrequest("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
