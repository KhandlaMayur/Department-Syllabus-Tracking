-- ============================================================
-- 026_create_cc_feedback_table.sql
-- Class Coordinator (CC) feedback for covered syllabus topics.
-- Only allowed after at least one student submits feedback.
-- Tracks reviewing CC faculty so new CC can see previous CC feedback.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS cc_feedback (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subtopic_id     INT UNSIGNED NOT NULL,
  subject_id      INT UNSIGNED NOT NULL,
  batch_id        INT UNSIGNED NOT NULL,
  division_id     INT UNSIGNED DEFAULT NULL,
  semester_number TINYINT UNSIGNED NOT NULL,
  faculty_id      INT UNSIGNED NOT NULL COMMENT 'references users.id — CC faculty who gave feedback',
  rating          TINYINT UNSIGNED NOT NULL COMMENT '1 to 5',
  comment         TEXT DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_ccfb_subtopic_batch (subtopic_id, batch_id),
  INDEX idx_ccfb_subject_batch (subject_id, batch_id),
  INDEX idx_ccfb_faculty (faculty_id),

  CONSTRAINT fk_ccfb_subtopic
    FOREIGN KEY (subtopic_id) REFERENCES syllabus_subtopics(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_ccfb_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_ccfb_faculty
    FOREIGN KEY (faculty_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_ccfb_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
