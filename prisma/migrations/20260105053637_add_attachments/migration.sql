-- AlterTable
ALTER TABLE `task` ADD COLUMN `attachments` JSON NULL;

-- AlterTable
ALTER TABLE `training` ADD COLUMN `attachments` JSON NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `managerId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
