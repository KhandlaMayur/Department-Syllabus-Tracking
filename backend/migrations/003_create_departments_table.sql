-- ============================================================
-- 003_create_departments_table.sql
-- Minimal department reference table so users can be scoped to a
-- department from Phase 1 onward (Syllabus/Subject tables in later
-- phases will hang off this too).
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS departments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  code          VARCHAR(20) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_departments_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
