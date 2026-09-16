-- ============================================================
-- 006_create_faculty_table.sql
-- Extends the users table for faculty-specific attributes.
-- A row exists here only for accounts with role faculty/hod/cc.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS faculty (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  employee_id   VARCHAR(30)  NOT NULL,
  designation   VARCHAR(100) DEFAULT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_faculty_user_id     (user_id),
  UNIQUE KEY uq_faculty_employee_id (employee_id),

  CONSTRAINT fk_faculty_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
