-- AlterTable
ALTER TABLE `department` ADD COLUMN `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employee` ALTER COLUMN `companyId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Answer_employeeId_fkey` ON `answer`(`employeeId`);

-- CreateIndex
CREATE INDEX `Candidate_jobId_fkey` ON `candidate`(`jobId`);

-- CreateIndex
CREATE INDEX `Project_companyId_fkey` ON `project`(`companyId`);

-- CreateIndex
CREATE INDEX `RecruitmentJob_companyId_fkey` ON `recruitmentjob`(`companyId`);

-- CreateIndex
CREATE INDEX `Task_employeeId_fkey` ON `task`(`employeeId`);

-- CreateIndex
CREATE INDEX `Task_projectId_fkey` ON `task`(`projectId`);

-- CreateIndex
CREATE INDEX `User_companyId_fkey` ON `user`(`companyId`);
