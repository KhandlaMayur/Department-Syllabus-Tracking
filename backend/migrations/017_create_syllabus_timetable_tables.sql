-- ============================================================
-- 017_create_syllabus_timetable_tables.sql
-- Syllabus units and timetable slots tables for import Phase 4.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS syllabus_units (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id   INT UNSIGNED NOT NULL,
  unit_number  TINYINT UNSIGNED NOT NULL,
  unit_title   VARCHAR(255) NOT NULL,
  topics       TEXT DEFAULT NULL,
  total_hours  TINYINT UNSIGNED DEFAULT NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_syllabus_subject_unit (subject_id, unit_number),
  KEY idx_syllabus_subject (subject_id),

  CONSTRAINT fk_syllabus_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timetable_slots (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id    INT UNSIGNED NOT NULL,
  division    VARCHAR(10)  DEFAULT NULL,
  day         ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
  period      TINYINT UNSIGNED NOT NULL,
  subject_id  INT UNSIGNED NOT NULL,
  faculty_id  INT UNSIGNED DEFAULT NULL,
  room        VARCHAR(50)  DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_timetable_slot (batch_id, division, day, period),
  KEY idx_tt_batch   (batch_id),
  KEY idx_tt_subject (subject_id),
  KEY idx_tt_faculty (faculty_id),

  CONSTRAINT fk_tt_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_tt_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_tt_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
