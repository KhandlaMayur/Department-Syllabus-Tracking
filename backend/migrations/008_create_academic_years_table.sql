-- ============================================================
-- 008_create_academic_years_table.sql
-- Represents an academic year like "2024-25".
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS academic_years (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(20)  NOT NULL COMMENT 'e.g. 2024-25',
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_academic_years_name (name),
  INDEX idx_academic_years_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
