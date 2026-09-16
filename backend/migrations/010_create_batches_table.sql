-- ============================================================
-- 010_create_batches_table.sql
-- A batch is a cohort of students (e.g. "2021-25").
-- Scoped to department + academic year.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS batches (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(30)  NOT NULL COMMENT 'e.g. 2021-25',
  department_id    INT UNSIGNED NOT NULL,
  academic_year_id INT UNSIGNED NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_batches_name_dept_year (name, department_id, academic_year_id),
  INDEX idx_batches_department (department_id),
  INDEX idx_batches_academic_year (academic_year_id),
  INDEX idx_batches_active (is_active),

  CONSTRAINT fk_batches_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_batches_academic_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
