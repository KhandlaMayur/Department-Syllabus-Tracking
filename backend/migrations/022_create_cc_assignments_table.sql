-- ============================================================
-- 022_create_cc_assignments_table.sql
-- Maps a faculty member as CC for a specific batch.
-- One CC per batch (UNIQUE on batch_id).
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS cc_assignments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id      INT UNSIGNED NOT NULL,
  faculty_id    INT UNSIGNED NOT NULL COMMENT 'references faculty.id',
  assigned_by   INT UNSIGNED DEFAULT NULL COMMENT 'references users.id — HOD who assigned',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_cc_assignment_batch (batch_id),
  INDEX idx_cc_faculty (faculty_id),
  INDEX idx_cc_active (is_active),

  CONSTRAINT fk_cc_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_cc_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_cc_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
