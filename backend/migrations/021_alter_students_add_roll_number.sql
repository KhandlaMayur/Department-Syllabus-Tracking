-- ============================================================
-- 021_alter_students_add_roll_number.sql
-- Adds roll_number column to students table.
-- ============================================================

USE syllabus_tracker;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS roll_number VARCHAR(30) DEFAULT NULL AFTER enrollment_number;

ALTER TABLE students
  ADD INDEX IF NOT EXISTS idx_students_roll_number (roll_number);
