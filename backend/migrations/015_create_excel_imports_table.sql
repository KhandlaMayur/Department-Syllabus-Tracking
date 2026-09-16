-- ============================================================
-- 015_create_excel_imports_table.sql
-- Tracks every Excel import job submitted through the HOD portal.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS excel_imports (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  import_type   ENUM('students','faculty','subjects','batches','syllabus','timetable') NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  status        ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
  total_rows    INT UNSIGNED NOT NULL DEFAULT 0,
  success_rows  INT UNSIGNED NOT NULL DEFAULT 0,
  updated_rows  INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_rows INT UNSIGNED NOT NULL DEFAULT 0,
  invalid_rows  INT UNSIGNED NOT NULL DEFAULT 0,
  failed_rows   INT UNSIGNED NOT NULL DEFAULT 0,
  imported_by   INT UNSIGNED NOT NULL,
  error_message TEXT DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_excel_imports_type   (import_type),
  KEY idx_excel_imports_status (status),
  KEY idx_excel_imports_by     (imported_by),

  CONSTRAINT fk_excel_imports_user
    FOREIGN KEY (imported_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
