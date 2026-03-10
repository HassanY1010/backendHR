/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `interview` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `jobId` to the `interview` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `AIUsageLog` DROP FOREIGN KEY `AIUsageLog_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `Answer` DROP FOREIGN KEY `Answer_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `Answer` DROP FOREIGN KEY `Answer_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Candidate` DROP FOREIGN KEY `Candidate_jobId_fkey`;

-- DropForeignKey
ALTER TABLE `CheckInAssessment` DROP FOREIGN KEY `CheckInAssessment_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `CheckInEntry` DROP FOREIGN KEY `CheckInEntry_assessmentId_fkey`;

-- DropForeignKey
ALTER TABLE `DailyQuestion` DROP FOREIGN KEY `DailyQuestion_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `Employee` DROP FOREIGN KEY `Employee_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `Employee` DROP FOREIGN KEY `Employee_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Interview` DROP FOREIGN KEY `Interview_candidateId_fkey`;

-- DropForeignKey
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Project` DROP FOREIGN KEY `Project_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `RecruitmentJob` DROP FOREIGN KEY `RecruitmentJob_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `SubscriptionCode` DROP FOREIGN KEY `SubscriptionCode_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `training_assignment` DROP FOREIGN KEY `training_assignment_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `TrainingRequest` DROP FOREIGN KEY `TrainingRequest_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_companyId_fkey`;

-- AlterTable
ALTER TABLE `Candidate` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('NEW', 'INTERVIEW_SENT', 'INTERVIEW_COMPLETED', 'SCREENING', 'PRE_ACCEPTED', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'HIRED') NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE `CheckInAssessment` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Interview` ADD COLUMN `aiScore` DOUBLE NULL,
    ADD COLUMN `aiSummary` LONGTEXT NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `jobId` VARCHAR(191) NOT NULL,
    ADD COLUMN `token` VARCHAR(191) NULL,
    ADD COLUMN `transcript` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `Project` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `RecruitmentJob` ADD COLUMN `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
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
ALTER TABLE `Task` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `training_assignment` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `training_course` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `deletedAt` DATETIME(3) NULL;

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
CREATE INDEX `Answer_employeeId_createdAt_idx` ON `Answer`(`employeeId`, `createdAt`);

-- CreateIndex
CREATE INDEX `candidate_jobId_deletedAt_idx` ON `Candidate`(`jobId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `candidate_status_deletedAt_idx` ON `Candidate`(`status`, `deletedAt`);

-- CreateIndex
CREATE INDEX `employee_companyId_deletedAt_idx` ON `Employee`(`companyId`, `deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `interview_token_key` ON `Interview`(`token`);

-- CreateIndex
CREATE INDEX `project_companyId_deletedAt_idx` ON `Project`(`companyId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `RecruitmentJob_companyId_status_idx` ON `RecruitmentJob`(`companyId`, `status`);

-- CreateIndex
CREATE INDEX `recruitmentjob_companyId_deletedAt_idx` ON `RecruitmentJob`(`companyId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `task_projectId_deletedAt_idx` ON `Task`(`projectId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `task_employeeId_deletedAt_idx` ON `Task`(`employeeId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `training_assignment_employeeId_deletedAt_idx` ON `training_assignment`(`employeeId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `training_course_status_deletedAt_idx` ON `training_course`(`status`, `deletedAt`);

-- CreateIndex
CREATE INDEX `user_companyId_deletedAt_idx` ON `User`(`companyId`, `deletedAt`);

-- AddForeignKey
ALTER TABLE `AIUsageLog` ADD CONSTRAINT `AIUsageLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Answer` ADD CONSTRAINT `Answer_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Answer` ADD CONSTRAINT `Answer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `DailyQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `RecruitmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CheckInAssessment` ADD CONSTRAINT `CheckInAssessment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CheckInEntry` ADD CONSTRAINT `CheckInEntry_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `CheckInAssessment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department` ADD CONSTRAINT `department_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyQuestion` ADD CONSTRAINT `DailyQuestion_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Interview` ADD CONSTRAINT `Interview_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecruitmentJob` ADD CONSTRAINT `RecruitmentJob_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecruitmentJob` ADD CONSTRAINT `recruitmentjob_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionCode` ADD CONSTRAINT `SubscriptionCode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_assignment` ADD CONSTRAINT `training_assignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingRequest` ADD CONSTRAINT `TrainingRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
