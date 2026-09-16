-- ============================================================
-- 016_create_excel_import_rows_table.sql
-- Stores per-row validation / insertion errors so HOD can
-- download a "failed rows" report after each import.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS excel_import_rows (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  import_id   INT UNSIGNED NOT NULL,
  row_number  INT UNSIGNED NOT NULL,
  row_data    JSON         NOT NULL,           -- raw row from Excel
  status      ENUM('success','duplicate','invalid','failed') NOT NULL,
  errors      JSON         DEFAULT NULL,       -- array of { field, message }
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_eir_import_id (import_id),
  KEY idx_eir_status    (status),

  CONSTRAINT fk_eir_import
    FOREIGN KEY (import_id) REFERENCES excel_imports(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
