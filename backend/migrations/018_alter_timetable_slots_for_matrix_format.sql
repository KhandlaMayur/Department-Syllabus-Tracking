-- ============================================================
-- 018_alter_timetable_slots_for_matrix_format.sql
-- Extends timetable_slots to support the real-world
-- matrix-style timetable format (batch_group A/B,
-- actual start/end times, faculty initials).
-- ============================================================

USE syllabus_tracker;

-- Make batch_id nullable (class can be identified by division alone)
ALTER TABLE timetable_slots
  MODIFY COLUMN batch_id INT UNSIGNED DEFAULT NULL;

-- Make period nullable (we now use start_time / end_time)
ALTER TABLE timetable_slots
  MODIFY COLUMN period TINYINT UNSIGNED DEFAULT NULL;

-- Add sub-batch group (A or B within a division, or ALL)
ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS batch_group VARCHAR(5)  DEFAULT NULL AFTER division;

-- Add real time columns instead of just a period number
ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS start_time VARCHAR(10)  DEFAULT NULL AFTER period,
  ADD COLUMN IF NOT EXISTS end_time   VARCHAR(10)  DEFAULT NULL AFTER start_time;

-- Store raw faculty initials (e.g. "BKP", "DG") when full employee_id not available
ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS faculty_initial VARCHAR(30) DEFAULT NULL AFTER faculty_id;

-- Store semester number for quick filtering
ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS semester TINYINT UNSIGNED DEFAULT NULL AFTER batch_group;

-- Update unique key to include batch_group and start_time
ALTER TABLE timetable_slots DROP INDEX IF EXISTS uq_timetable_slot;

ALTER TABLE timetable_slots
  ADD UNIQUE KEY uq_timetable_slot
    (batch_id, division, batch_group, day, start_time);
