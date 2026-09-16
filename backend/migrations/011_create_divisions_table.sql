-- ============================================================
-- 011_create_divisions_table.sql
-- A division (A/B/C) belongs to a batch + semester.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS divisions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(10)  NOT NULL COMMENT 'e.g. A, B, C',
  batch_id    INT UNSIGNED NOT NULL,
  semester_id INT UNSIGNED NOT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_divisions_name_batch_sem (name, batch_id, semester_id),
  INDEX idx_divisions_batch (batch_id),
  INDEX idx_divisions_semester (semester_id),
  INDEX idx_divisions_active (is_active),

  CONSTRAINT fk_divisions_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_divisions_semester
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
