-- AlterTable
ALTER TABLE `training_assignment` ADD COLUMN `quiz` LONGTEXT NULL,
    ADD COLUMN `quizAnswers` LONGTEXT NULL,
    ADD COLUMN `quizScore` DOUBLE NULL,
    ADD COLUMN `trainingPlan` LONGTEXT NULL;
