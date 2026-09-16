-- ============================================================
-- 024_create_student_feedback_table.sql
-- Student feedback for covered syllabus topics.
-- One feedback per student per subtopic per batch.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS student_feedback (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subtopic_id     INT UNSIGNED NOT NULL,
  subject_id      INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL COMMENT 'references users.id',
  batch_id        INT UNSIGNED NOT NULL,
  semester_number TINYINT UNSIGNED NOT NULL,
  faculty_id      INT UNSIGNED DEFAULT NULL COMMENT 'references users.id — who covered the topic',
  rating          TINYINT UNSIGNED NOT NULL COMMENT '1 to 5',
  comment         TEXT DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_student_feedback (subtopic_id, student_id, batch_id),
  INDEX idx_sf_subject (subject_id),
  INDEX idx_sf_student (student_id),
  INDEX idx_sf_batch (batch_id),
  INDEX idx_sf_faculty (faculty_id),

  CONSTRAINT fk_sf_subtopic
    FOREIGN KEY (subtopic_id) REFERENCES syllabus_subtopics(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_sf_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_sf_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_sf_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_sf_faculty
    FOREIGN KEY (faculty_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
