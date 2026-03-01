/*
  Warnings:

  - You are about to drop the column `trainingId` on the `trainingrequest` table. All the data in the column will be lost.
  - You are about to drop the `employeetraining` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `training` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `employeetraining` DROP FOREIGN KEY `EmployeeTraining_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `employeetraining` DROP FOREIGN KEY `EmployeeTraining_trainingId_fkey`;

-- DropForeignKey
ALTER TABLE `trainingrequest` DROP FOREIGN KEY `TrainingRequest_trainingId_fkey`;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `estimatedTimeUnit` VARCHAR(191) NULL DEFAULT 'HOURS';

-- AlterTable
ALTER TABLE `trainingrequest` DROP COLUMN `trainingId`,
    ADD COLUMN `courseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `nameEn` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `employeetraining`;

-- DropTable
DROP TABLE `training`;

-- CreateTable
CREATE TABLE `competitor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `marketShare` DOUBLE NOT NULL,
    `growthRate` DOUBLE NULL,
    `strengths` LONGTEXT NULL,
    `weaknesses` LONGTEXT NULL,
    `color` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketmetric` (
    `id` VARCHAR(191) NOT NULL,
    `metric` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_course` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `provider` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL DEFAULT 'ar',
    `level` VARCHAR(191) NULL DEFAULT 'beginner',
    `duration` INTEGER NOT NULL,
    `skills` LONGTEXT NULL,
    `isFree` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_assignment` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EVALUATED', 'ARCHIVED') NOT NULL DEFAULT 'PENDING',
    `progress` DOUBLE NOT NULL DEFAULT 0,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `evaluatedAt` DATETIME(3) NULL,
    `impactScore` DOUBLE NULL,
    `impactAnalysis` TEXT NULL,
    `certificateUrl` VARCHAR(191) NULL,
    `employeeNotes` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `training_assignment_employeeId_idx`(`employeeId`),
    INDEX `training_assignment_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AIUsageLog_service_idx` ON `aiusagelog`(`service`);

-- CreateIndex
CREATE INDEX `AuditLog_actionType_idx` ON `auditlog`(`actionType`);

-- CreateIndex
CREATE INDEX `Employee_department_idx` ON `employee`(`department`);

-- CreateIndex
CREATE INDEX `Employee_userId_idx` ON `employee`(`userId`);

-- CreateIndex
CREATE INDEX `Notification_isRead_idx` ON `notification`(`isRead`);

-- CreateIndex
CREATE INDEX `Project_status_idx` ON `project`(`status`);

-- CreateIndex
CREATE INDEX `Task_status_idx` ON `task`(`status`);

-- CreateIndex
CREATE INDEX `TrainingRequest_courseId_fkey` ON `trainingrequest`(`courseId`);

-- CreateIndex
CREATE INDEX `User_email_idx` ON `user`(`email`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `user`(`role`);

-- AddForeignKey
ALTER TABLE `training_assignment` ADD CONSTRAINT `training_assignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_assignment` ADD CONSTRAINT `training_assignment_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `training_course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trainingrequest` ADD CONSTRAINT `TrainingRequest_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `training_course`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `AIUsageLog_companyId_idx` ON `aiusagelog`(`companyId`);
-- DROP INDEX `AIUsageLog_companyId_fkey` ON `aiusagelog`;

-- RedefineIndex
CREATE INDEX `AuditLog_companyId_idx` ON `auditlog`(`companyId`);
-- DROP INDEX `AuditLog_companyId_fkey` ON `auditlog`;

-- RedefineIndex
CREATE INDEX `AuditLog_userId_idx` ON `auditlog`(`userId`);
-- DROP INDEX `AuditLog_userId_fkey` ON `auditlog`;

-- RedefineIndex
CREATE INDEX `Employee_companyId_idx` ON `employee`(`companyId`);
-- DROP INDEX `Employee_companyId_fkey` ON `employee`;

-- RedefineIndex
CREATE INDEX `Notification_employeeId_idx` ON `notification`(`employeeId`);
-- DROP INDEX `Notification_employeeId_fkey` ON `notification`;
