-- ============================================================
-- 023_create_topic_completions_table.sql
-- Tracks which syllabus subtopics have been marked as covered
-- by faculty/CC for a specific batch.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS topic_completions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subtopic_id     INT UNSIGNED NOT NULL,
  subject_id      INT UNSIGNED NOT NULL,
  batch_id        INT UNSIGNED NOT NULL,
  semester_number TINYINT UNSIGNED NOT NULL,
  completed_by    INT UNSIGNED NOT NULL COMMENT 'references users.id',
  completed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_topic_completion (subtopic_id, batch_id),
  INDEX idx_tc_subject (subject_id),
  INDEX idx_tc_batch (batch_id),
  INDEX idx_tc_completed_by (completed_by),

  CONSTRAINT fk_tc_subtopic
    FOREIGN KEY (subtopic_id) REFERENCES syllabus_subtopics(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_tc_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_tc_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_tc_completed_by
    FOREIGN KEY (completed_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
