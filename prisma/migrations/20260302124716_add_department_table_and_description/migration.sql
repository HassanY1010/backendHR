-- AlterTable
ALTER TABLE `department` ADD COLUMN `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Employee` ALTER COLUMN `companyId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Answer_employeeId_fkey` ON `Answer`(`employeeId`);

-- CreateIndex
CREATE INDEX `Candidate_jobId_fkey` ON `Candidate`(`jobId`);

-- CreateIndex
CREATE INDEX `Project_companyId_fkey` ON `Project`(`companyId`);

-- CreateIndex
CREATE INDEX `RecruitmentJob_companyId_fkey` ON `RecruitmentJob`(`companyId`);

-- CreateIndex
CREATE INDEX `Task_employeeId_fkey` ON `Task`(`employeeId`);

-- CreateIndex
CREATE INDEX `Task_projectId_fkey` ON `Task`(`projectId`);

-- CreateIndex
CREATE INDEX `User_companyId_fkey` ON `User`(`companyId`);
