-- ============================================================
-- 005_create_students_table.sql
-- Extends the users table for student-specific attributes.
-- A row exists here only for accounts with role = 'student'.
-- google_id in users can be NULL until the student first logs in.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS students (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           INT UNSIGNED NOT NULL,
  enrollment_number VARCHAR(30)  NOT NULL,
  semester          TINYINT UNSIGNED DEFAULT NULL,
  division          VARCHAR(10)  DEFAULT NULL,
  batch             VARCHAR(20)  DEFAULT NULL,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_students_user_id           (user_id),
  UNIQUE KEY uq_students_enrollment_number (enrollment_number),

  CONSTRAINT fk_students_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
