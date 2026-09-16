-- ============================================================
-- 009_create_semesters_table.sql
-- A semester belongs to an academic year (e.g. Semester 5, 2024-25).
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS semesters (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id INT UNSIGNED NOT NULL,
  number           TINYINT UNSIGNED NOT NULL COMMENT '1 through 8',
  start_date       DATE         DEFAULT NULL,
  end_date         DATE         DEFAULT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_semesters_year_number (academic_year_id, number),
  INDEX idx_semesters_active (is_active),

  CONSTRAINT fk_semesters_academic_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
