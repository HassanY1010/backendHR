-- table department
CREATE TABLE IF NOT EXISTS department (
  id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  companyId VARCHAR(36) NOT NULL,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS department_companyId_idx ON department (companyId);

-- table marketmetric
CREATE TABLE IF NOT EXISTS marketmetric (
  id VARCHAR(36) NOT NULL,
  metric VARCHAR(255) NOT NULL,
  value FLOAT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  source VARCHAR(255),
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- table training_course
CREATE TABLE IF NOT EXISTS training_course (
  id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  provider VARCHAR(255),
  category VARCHAR(255),
  url VARCHAR(255),
  language VARCHAR(10) DEFAULT 'ar',
  level VARCHAR(50) DEFAULT 'beginner',
  duration INT NOT NULL,
  skills TEXT,
  isFree BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP,
  PRIMARY KEY (id)
);

-- table training_assignment
CREATE TABLE IF NOT EXISTS training_assignment (
  id VARCHAR(36) NOT NULL,
  employeeId VARCHAR(36) NOT NULL,
  courseId VARCHAR(36) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  progress FLOAT DEFAULT 0,
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  startedAt TIMESTAMP,
  completedAt TIMESTAMP,
  evaluatedAt TIMESTAMP,
  impactScore FLOAT,
  impactAnalysis TEXT,
  trainingPlan TEXT,
  quiz TEXT,
  quizAnswers TEXT,
  quizScore FLOAT,
  certificateUrl VARCHAR(255),
  employeeNotes TEXT,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS training_assignment_employeeId_idx ON training_assignment (employeeId);
CREATE INDEX IF NOT EXISTS training_assignment_courseId_idx ON training_assignment (courseId);

-- table trainingrequest
CREATE TABLE IF NOT EXISTS trainingrequest (
  id VARCHAR(36) NOT NULL,
  employeeId VARCHAR(36) NOT NULL,
  courseId VARCHAR(36),
  topic VARCHAR(255),
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  aiScore FLOAT,
  aiAnalysis TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS trainingrequest_employeeId_idx ON trainingrequest (employeeId);
CREATE INDEX IF NOT EXISTS trainingrequest_courseId_idx ON trainingrequest (courseId);
