-- AlterTable
ALTER TABLE `Candidate` ADD COLUMN `aiAnalysisDetails` JSON NULL,
    ADD COLUMN `resumePath` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Interview` ADD COLUMN `duration` INTEGER NULL,
    ADD COLUMN `interviewerName` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled';
