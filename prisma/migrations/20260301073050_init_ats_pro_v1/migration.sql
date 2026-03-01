/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `interview` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `jobId` to the `interview` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `aiusagelog` DROP FOREIGN KEY `AIUsageLog_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `answer` DROP FOREIGN KEY `Answer_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `answer` DROP FOREIGN KEY `Answer_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `auditlog` DROP FOREIGN KEY `AuditLog_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `auditlog` DROP FOREIGN KEY `AuditLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `candidate` DROP FOREIGN KEY `Candidate_jobId_fkey`;

-- DropForeignKey
ALTER TABLE `checkinassessment` DROP FOREIGN KEY `CheckInAssessment_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `checkinentry` DROP FOREIGN KEY `CheckInEntry_assessmentId_fkey`;

-- DropForeignKey
ALTER TABLE `dailyquestion` DROP FOREIGN KEY `DailyQuestion_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `employee` DROP FOREIGN KEY `Employee_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `employee` DROP FOREIGN KEY `Employee_userId_fkey`;

-- DropForeignKey
ALTER TABLE `interview` DROP FOREIGN KEY `Interview_candidateId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_userId_fkey`;

-- DropForeignKey
ALTER TABLE `project` DROP FOREIGN KEY `Project_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `recruitmentjob` DROP FOREIGN KEY `RecruitmentJob_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `subscription` DROP FOREIGN KEY `Subscription_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `subscriptioncode` DROP FOREIGN KEY `SubscriptionCode_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `training_assignment` DROP FOREIGN KEY `training_assignment_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `trainingrequest` DROP FOREIGN KEY `TrainingRequest_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_companyId_fkey`;

-- AlterTable
ALTER TABLE `candidate` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('NEW', 'INTERVIEW_SENT', 'INTERVIEW_COMPLETED', 'SCREENING', 'PRE_ACCEPTED', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'HIRED') NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE `checkinassessment` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `employee` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `interview` ADD COLUMN `aiScore` DOUBLE NULL,
    ADD COLUMN `aiSummary` LONGTEXT NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `jobId` VARCHAR(191) NOT NULL,
    ADD COLUMN `token` VARCHAR(191) NULL,
    ADD COLUMN `transcript` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `project` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `recruitmentjob` ADD COLUMN `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `createdBy` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `departmentId` VARCHAR(191) NULL,
    ADD COLUMN `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT') NOT NULL DEFAULT 'FULL_TIME',
    ADD COLUMN `managedTeamBefore` BOOLEAN NULL,
    ADD COLUMN `openingReason` ENUM('NEW_ROLE', 'EXPANSION', 'REPLACEMENT', 'PROJECT', 'RESTRUCTURE') NOT NULL DEFAULT 'NEW_ROLE',
    ADD COLUMN `previousCompanyType` ENUM('STARTUP', 'CORPORATE', 'TECH', 'GOVERNMENT') NULL,
    ADD COLUMN `salaryMax` INTEGER NULL,
    ADD COLUMN `salaryMin` INTEGER NULL,
    ADD COLUMN `seniorityLevel` ENUM('JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER') NOT NULL DEFAULT 'MID',
    ADD COLUMN `teamSize` INTEGER NULL,
    ADD COLUMN `workEnvironment` ENUM('STARTUP', 'CORPORATE', 'HIGH_PRESSURE', 'STABLE') NULL,
    ADD COLUMN `workMode` ENUM('ONSITE', 'HYBRID', 'REMOTE') NOT NULL DEFAULT 'ONSITE',
    ADD COLUMN `yearsOfExperience` INTEGER NULL;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `training_assignment` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `training_course` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `department` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `searchindex` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `metadata` LONGTEXT NULL,
    `vector` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `searchindex_companyId_idx`(`companyId`),
    INDEX `searchindex_documentType_idx`(`documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Answer_employeeId_createdAt_idx` ON `answer`(`employeeId`, `createdAt`);

-- CreateIndex
CREATE INDEX `candidate_jobId_deletedAt_idx` ON `candidate`(`jobId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `candidate_status_deletedAt_idx` ON `candidate`(`status`, `deletedAt`);

-- CreateIndex
CREATE INDEX `employee_companyId_deletedAt_idx` ON `employee`(`companyId`, `deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `interview_token_key` ON `interview`(`token`);

-- CreateIndex
CREATE INDEX `project_companyId_deletedAt_idx` ON `project`(`companyId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `RecruitmentJob_companyId_status_idx` ON `recruitmentjob`(`companyId`, `status`);

-- CreateIndex
CREATE INDEX `recruitmentjob_companyId_deletedAt_idx` ON `recruitmentjob`(`companyId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `task_projectId_deletedAt_idx` ON `task`(`projectId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `task_employeeId_deletedAt_idx` ON `task`(`employeeId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `training_assignment_employeeId_deletedAt_idx` ON `training_assignment`(`employeeId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `training_course_status_deletedAt_idx` ON `training_course`(`status`, `deletedAt`);

-- CreateIndex
CREATE INDEX `user_companyId_deletedAt_idx` ON `user`(`companyId`, `deletedAt`);

-- AddForeignKey
ALTER TABLE `aiusagelog` ADD CONSTRAINT `AIUsageLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answer` ADD CONSTRAINT `Answer_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answer` ADD CONSTRAINT `Answer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `dailyquestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditlog` ADD CONSTRAINT `AuditLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditlog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate` ADD CONSTRAINT `Candidate_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `recruitmentjob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkinassessment` ADD CONSTRAINT `CheckInAssessment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkinentry` ADD CONSTRAINT `CheckInEntry_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `checkinassessment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department` ADD CONSTRAINT `department_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dailyquestion` ADD CONSTRAINT `DailyQuestion_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview` ADD CONSTRAINT `Interview_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `Project_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitmentjob` ADD CONSTRAINT `RecruitmentJob_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitmentjob` ADD CONSTRAINT `recruitmentjob_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `Subscription_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptioncode` ADD CONSTRAINT `SubscriptionCode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_assignment` ADD CONSTRAINT `training_assignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trainingrequest` ADD CONSTRAINT `TrainingRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
