-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_employeeId_fkey`;

-- AlterTable
ALTER TABLE `notification` ADD COLUMN `userId` VARCHAR(191) NULL,
    MODIFY `employeeId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
