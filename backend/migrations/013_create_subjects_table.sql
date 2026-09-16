-- ============================================================
-- 013_create_subjects_table.sql
-- A subject (course) defined at department + semester level.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS subjects (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20)   NOT NULL COMMENT 'e.g. CS501',
  name            VARCHAR(150)  NOT NULL,
  department_id   INT UNSIGNED  NOT NULL,
  semester_number TINYINT UNSIGNED NOT NULL COMMENT '1 through 8',
  credits         DECIMAL(3,1)  NOT NULL DEFAULT 4.0,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_subjects_code (code),
  INDEX idx_subjects_department (department_id),
  INDEX idx_subjects_semester (semester_number),
  INDEX idx_subjects_active (is_active),

  CONSTRAINT fk_subjects_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
