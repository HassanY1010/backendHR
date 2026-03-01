-- AlterTable
ALTER TABLE `candidate` ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `termsAcceptedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `interview` ADD COLUMN `candidateFeedback` TEXT NULL,
    ADD COLUMN `candidateRating` INTEGER NULL;

-- CreateTable
CREATE TABLE `SubscriptionCode` (
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

-- CreateIndex
CREATE INDEX `CheckInQuestion_type_isActive_idx` ON `CheckInQuestion`(`type`, `isActive`);

-- AddForeignKey
ALTER TABLE `SubscriptionCode` ADD CONSTRAINT `SubscriptionCode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
