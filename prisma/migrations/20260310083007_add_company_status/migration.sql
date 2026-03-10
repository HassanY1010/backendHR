/*
  Warnings:

  - You are about to drop the `AIQualityMetric` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AIUsageLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Answer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Candidate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CheckInAssessment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CheckInEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CheckInQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Company` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DailyQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Employee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FeatureFlag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FinanceMetric` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FinancialTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Interview` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Milestone` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlatformFeature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductMetric` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductUsage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecruitmentJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RoadmapItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SystemSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrainingRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

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
ALTER TABLE `Project` DROP FOREIGN KEY `Project_managerId_fkey`;

-- DropForeignKey
ALTER TABLE `RecruitmentJob` DROP FOREIGN KEY `RecruitmentJob_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `RecruitmentJob` DROP FOREIGN KEY `recruitmentjob_departmentId_fkey`;

-- DropForeignKey
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `SubscriptionCode` DROP FOREIGN KEY `SubscriptionCode_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `Task` DROP FOREIGN KEY `Task_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `Task` DROP FOREIGN KEY `Task_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `TrainingRequest` DROP FOREIGN KEY `TrainingRequest_courseId_fkey`;

-- DropForeignKey
ALTER TABLE `TrainingRequest` DROP FOREIGN KEY `TrainingRequest_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_managerId_fkey`;

-- DropForeignKey
ALTER TABLE `department` DROP FOREIGN KEY `department_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `training_assignment` DROP FOREIGN KEY `training_assignment_employeeId_fkey`;

-- AlterTable
ALTER TABLE `department` ADD COLUMN `parentId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `AIQualityMetric`;

-- DropTable
DROP TABLE `AIUsageLog`;

-- DropTable
DROP TABLE `Answer`;

-- DropTable
DROP TABLE `AuditLog`;

-- DropTable
DROP TABLE `Candidate`;

-- DropTable
DROP TABLE `CheckInAssessment`;

-- DropTable
DROP TABLE `CheckInEntry`;

-- DropTable
DROP TABLE `CheckInQuestion`;

-- DropTable
DROP TABLE `Company`;

-- DropTable
DROP TABLE `DailyQuestion`;

-- DropTable
DROP TABLE `Employee`;

-- DropTable
DROP TABLE `FeatureFlag`;

-- DropTable
DROP TABLE `FinanceMetric`;

-- DropTable
DROP TABLE `FinancialTransaction`;

-- DropTable
DROP TABLE `Interview`;

-- DropTable
DROP TABLE `Milestone`;

-- DropTable
DROP TABLE `Notification`;

-- DropTable
DROP TABLE `PlatformFeature`;

-- DropTable
DROP TABLE `ProductMetric`;

-- DropTable
DROP TABLE `ProductUsage`;

-- DropTable
DROP TABLE `Project`;

-- DropTable
DROP TABLE `RecruitmentJob`;

-- DropTable
DROP TABLE `RoadmapItem`;

-- DropTable
DROP TABLE `Subscription`;

-- DropTable
DROP TABLE `SubscriptionCode`;

-- DropTable
DROP TABLE `SystemSetting`;

-- DropTable
DROP TABLE `Task`;

-- DropTable
DROP TABLE `TrainingRequest`;

-- DropTable
DROP TABLE `User`;

-- CreateTable
CREATE TABLE `aiqualitymetric` (
    `id` VARCHAR(191) NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `accuracy` DOUBLE NOT NULL,
    `precision` DOUBLE NOT NULL,
    `recall` DOUBLE NOT NULL,
    `latency` INTEGER NOT NULL,
    `costPerRequest` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'production',
    `lastUpdated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AIQualityMetric_modelName_key`(`modelName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aiusagelog` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `tokens` INTEGER NOT NULL DEFAULT 0,
    `cost` DOUBLE NOT NULL DEFAULT 0,
    `prompt` TEXT NULL,
    `response` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIUsageLog_companyId_idx`(`companyId`),
    INDEX `AIUsageLog_service_idx`(`service`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `answer` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `aiSentiment` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Answer_employeeId_fkey`(`employeeId`),
    INDEX `Answer_questionId_fkey`(`questionId`),
    INDEX `Answer_employeeId_createdAt_idx`(`employeeId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditlog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'low',
    `target` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'success',
    `ip` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `companyId` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actionType_idx`(`actionType`),
    INDEX `AuditLog_companyId_idx`(`companyId`),
    INDEX `AuditLog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `resumeUrl` VARCHAR(191) NULL,
    `coverLetter` TEXT NULL,
    `experience` INTEGER NULL,
    `education` LONGTEXT NULL,
    `skills` LONGTEXT NULL,
    `aiScore` DOUBLE NULL,
    `aiSummary` TEXT NULL,
    `status` ENUM('NEW', 'INTERVIEW_SENT', 'INTERVIEW_COMPLETED', 'SCREENING', 'PRE_ACCEPTED', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'HIRED') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `aiStatus` VARCHAR(191) NULL,
    `interviewCode` VARCHAR(191) NULL,
    `aiAnalysisDetails` LONGTEXT NULL,
    `resumePath` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `termsAcceptedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Candidate_interviewCode_key`(`interviewCode`),
    INDEX `Candidate_jobId_fkey`(`jobId`),
    INDEX `candidate_jobId_deletedAt_idx`(`jobId`, `deletedAt`),
    INDEX `candidate_status_deletedAt_idx`(`status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkinassessment` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `score` DOUBLE NULL,
    `riskLevel` VARCHAR(191) NULL,
    `recommendation` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `CheckInAssessment_employeeId_fkey`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkinentry` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `questionType` VARCHAR(191) NOT NULL,
    `questionText` VARCHAR(191) NOT NULL,
    `answerText` VARCHAR(191) NULL,
    `answerValue` INTEGER NULL,
    `isSkipped` BOOLEAN NOT NULL DEFAULT false,
    `timeToAnswer` INTEGER NULL,
    `unlockTime` DATETIME(3) NOT NULL,
    `answeredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CheckInEntry_assessmentId_fkey`(`assessmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkinquestion` (
    `id` VARCHAR(191) NOT NULL,
    `text` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `answerType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CheckInQuestion_type_isActive_idx`(`type`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subscriptionStatus` VARCHAR(191) NOT NULL DEFAULT 'TRIAL',
    `subscriptionExpiry` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `address` VARCHAR(191) NULL,
    `employeeLimit` INTEGER NOT NULL DEFAULT 10,
    `language` VARCHAR(191) NOT NULL DEFAULT 'ar',
    `logo` VARCHAR(191) NULL,
    `settings` LONGTEXT NULL,
    `website` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dailyquestion` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DailyQuestion_companyId_fkey`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `riskLevel` DOUBLE NOT NULL DEFAULT 0,
    `performanceScore` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',

    UNIQUE INDEX `Employee_userId_key`(`userId`),
    INDEX `Employee_companyId_idx`(`companyId`),
    INDEX `employee_companyId_deletedAt_idx`(`companyId`, `deletedAt`),
    INDEX `Employee_department_idx`(`department`),
    INDEX `Employee_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `featureflag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `risk` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'LOW',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financemetric` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `change` DOUBLE NOT NULL DEFAULT 0,
    `trend` VARCHAR(191) NOT NULL DEFAULT 'stable',
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FinanceMetric_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financialtransaction` (
    `id` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `category` ENUM('SALARIES', 'INFRASTRUCTURE', 'MARKETING', 'DEVELOPMENT', 'SUBSCRIPTIONS', 'OTHER') NOT NULL,
    `description` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview` (
    `id` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `score` DOUBLE NULL,
    `notes` TEXT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `scheduledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aiAnalysis` LONGTEXT NULL,
    `videoUrl` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `interviewerName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
    `candidateFeedback` TEXT NULL,
    `candidateRating` INTEGER NULL,
    `token` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `aiScore` DOUBLE NULL,
    `aiSummary` LONGTEXT NULL,
    `transcript` LONGTEXT NULL,

    UNIQUE INDEX `interview_token_key`(`token`),
    INDEX `Interview_candidateId_fkey`(`candidateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `milestone` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `targetDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `features` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'info',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `metadata` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NULL,

    INDEX `Notification_employeeId_idx`(`employeeId`),
    INDEX `Notification_isRead_idx`(`isRead`),
    INDEX `Notification_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platformfeature` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'planned',
    `releaseDate` DATETIME(3) NULL,
    `votes` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productmetric` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('ENGAGEMENT', 'ADOPTION', 'PERFORMANCE', 'USAGE') NOT NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NULL,
    `change` DOUBLE NULL,
    `trend` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productusage` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `activeUsers` INTEGER NOT NULL,
    `sessions` INTEGER NOT NULL,
    `avgSessionDuration` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductUsage_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNING',
    `startDate` DATETIME(3) NULL,
    `deadline` DATETIME(3) NULL,
    `budget` DOUBLE NULL,
    `spent` DOUBLE NULL DEFAULT 0,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `aiRecommendation` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Project_companyId_fkey`(`companyId`),
    INDEX `project_companyId_deletedAt_idx`(`companyId`, `deletedAt`),
    INDEX `Project_managerId_fkey`(`managerId`),
    INDEX `Project_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recruitmentjob` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT') NOT NULL DEFAULT 'FULL_TIME',
    `city` VARCHAR(191) NULL,
    `workMode` ENUM('ONSITE', 'HYBRID', 'REMOTE') NOT NULL DEFAULT 'ONSITE',
    `seniorityLevel` ENUM('JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER') NOT NULL DEFAULT 'MID',
    `yearsOfExperience` INTEGER NULL,
    `previousCompanyType` ENUM('STARTUP', 'CORPORATE', 'TECH', 'GOVERNMENT') NULL,
    `managedTeamBefore` BOOLEAN NULL,
    `teamSize` INTEGER NULL,
    `salaryMin` INTEGER NULL,
    `salaryMax` INTEGER NULL,
    `workEnvironment` ENUM('STARTUP', 'CORPORATE', 'HIGH_PRESSURE', 'STABLE') NULL,
    `openingReason` ENUM('NEW_ROLE', 'EXPANSION', 'REPLACEMENT', 'PROJECT', 'RESTRUCTURE') NOT NULL DEFAULT 'NEW_ROLE',
    `description` TEXT NOT NULL,
    `requirements` LONGTEXT NULL,
    `responsibilities` LONGTEXT NULL,
    `salaryRange` LONGTEXT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'ON_HOLD') NOT NULL DEFAULT 'OPEN',
    `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `aiDescription` TEXT NULL,

    INDEX `RecruitmentJob_companyId_fkey`(`companyId`),
    INDEX `RecruitmentJob_companyId_status_idx`(`companyId`, `status`),
    INDEX `recruitmentjob_companyId_deletedAt_idx`(`companyId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roadmapitem` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'planned',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `category` VARCHAR(191) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'FREE_TRIAL',
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subscription_companyId_fkey`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptioncode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UNUSED',
    `companyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usedAt` DATETIME(3) NULL,

    UNIQUE INDEX `SubscriptionCode_code_key`(`code`),
    UNIQUE INDEX `SubscriptionCode_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `systemsetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `employeeId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `actualTime` DOUBLE NULL,
    `aiScore` DOUBLE NULL,
    `complexity` VARCHAR(191) NULL,
    `dependencies` LONGTEXT NULL,
    `estimatedTime` DOUBLE NULL,
    `estimatedTimeUnit` VARCHAR(191) NULL DEFAULT 'HOURS',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `projectId` VARCHAR(191) NULL,
    `attachments` LONGTEXT NULL,

    INDEX `Task_employeeId_fkey`(`employeeId`),
    INDEX `Task_projectId_fkey`(`projectId`),
    INDEX `task_projectId_deletedAt_idx`(`projectId`, `deletedAt`),
    INDEX `task_employeeId_deletedAt_idx`(`employeeId`, `deletedAt`),
    INDEX `Task_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trainingrequest` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `topic` VARCHAR(191) NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `aiScore` DOUBLE NULL,
    `aiAnalysis` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrainingRequest_employeeId_fkey`(`employeeId`),
    INDEX `TrainingRequest_courseId_fkey`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `companyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `avatar` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `lastLogin` DATETIME(3) NULL,
    `phone` VARCHAR(191) NULL,
    `settings` LONGTEXT NULL,
    `managerId` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `nameEn` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_companyId_fkey`(`companyId`),
    INDEX `user_companyId_deletedAt_idx`(`companyId`, `deletedAt`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_managerId_fkey`(`managerId`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `department_parentId_idx` ON `department`(`parentId`);

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
ALTER TABLE `department` ADD CONSTRAINT `department_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `project` ADD CONSTRAINT `Project_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitmentjob` ADD CONSTRAINT `RecruitmentJob_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recruitmentjob` ADD CONSTRAINT `recruitmentjob_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `Subscription_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptioncode` ADD CONSTRAINT `SubscriptionCode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `Task_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `Task_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_assignment` ADD CONSTRAINT `training_assignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trainingrequest` ADD CONSTRAINT `TrainingRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trainingrequest` ADD CONSTRAINT `TrainingRequest_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `training_course`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `User_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `department` RENAME INDEX `department_companyId_fkey` TO `department_companyId_idx`;
