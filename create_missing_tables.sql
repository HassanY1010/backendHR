-- جدول Department
CREATE TABLE IF NOT EXISTS `department` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `companyId` CHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `department_companyId_idx` (`companyId`)
);

-- جدول MarketMetric
CREATE TABLE IF NOT EXISTS `marketmetric` (
  `id` CHAR(36) NOT NULL,
  `metric` VARCHAR(255) NOT NULL,
  `value` FLOAT NOT NULL,
  `unit` VARCHAR(50) NOT NULL,
  `source` VARCHAR(255),
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- جدول TrainingCourse
CREATE TABLE IF NOT EXISTS `training_course` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `provider` VARCHAR(255),
  `category` VARCHAR(255),
  `url` VARCHAR(255),
  `language` VARCHAR(10) DEFAULT 'ar',
  `level` VARCHAR(50) DEFAULT 'beginner',
  `duration` INT NOT NULL,
  `skills` TEXT,
  `isFree` BOOLEAN DEFAULT TRUE,
  `status` VARCHAR(50) DEFAULT 'active',
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` DATETIME,
  PRIMARY KEY (`id`)
);

-- جدول TrainingAssignment
CREATE TABLE IF NOT EXISTS `training_assignment` (
  `id` CHAR(36) NOT NULL,
  `employeeId` CHAR(36) NOT NULL,
  `courseId` CHAR(36) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'PENDING',
  `progress` FLOAT DEFAULT 0,
  `assignedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `startedAt` DATETIME,
  `completedAt` DATETIME,
  `evaluatedAt` DATETIME,
  `impactScore` FLOAT,
  `impactAnalysis` TEXT,
  `trainingPlan` TEXT,
  `quiz` TEXT,
  `quizAnswers` TEXT,
  `quizScore` FLOAT,
  `certificateUrl` VARCHAR(255),
  `employeeNotes` TEXT,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` DATETIME,
  PRIMARY KEY (`id`),
  INDEX `training_assignment_employeeId_idx` (`employeeId`),
  INDEX `training_assignment_courseId_idx` (`courseId`)
);

-- جدول TrainingRequest
CREATE TABLE IF NOT EXISTS `trainingrequest` (
  `id` CHAR(36) NOT NULL,
  `employeeId` CHAR(36) NOT NULL,
  `courseId` CHAR(36),
  `topic` VARCHAR(255),
  `reason` TEXT NOT NULL,
  `status` VARCHAR(50) DEFAULT 'PENDING',
  `aiScore` FLOAT,
  `aiAnalysis` TEXT,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `trainingrequest_employeeId_idx` (`employeeId`),
  INDEX `trainingrequest_courseId_idx` (`courseId`)
);

