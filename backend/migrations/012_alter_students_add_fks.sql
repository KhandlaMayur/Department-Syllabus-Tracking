-- ============================================================
-- 012_alter_students_add_fks.sql
-- Adds proper FK columns to the students table alongside the
-- existing raw string columns (non-breaking, additive only).
-- ============================================================

USE syllabus_tracker;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS batch_id    INT UNSIGNED DEFAULT NULL AFTER batch,
  ADD COLUMN IF NOT EXISTS division_id INT UNSIGNED DEFAULT NULL AFTER division,
  ADD COLUMN IF NOT EXISTS semester_id INT UNSIGNED DEFAULT NULL AFTER semester;

-- Add indexes
ALTER TABLE students
  ADD INDEX IF NOT EXISTS idx_students_batch    (batch_id),
  ADD INDEX IF NOT EXISTS idx_students_division (division_id),
  ADD INDEX IF NOT EXISTS idx_students_semester (semester_id);

-- Add foreign keys (best-effort: skip if already exist)
ALTER TABLE students
  ADD CONSTRAINT fk_students_batch
    FOREIGN KEY (batch_id) REFERENCES batches(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE students
  ADD CONSTRAINT fk_students_division
    FOREIGN KEY (division_id) REFERENCES divisions(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE students
  ADD CONSTRAINT fk_students_semester
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
