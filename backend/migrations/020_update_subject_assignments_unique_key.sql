-- ============================================================
-- 020_update_subject_assignments_unique_key.sql
-- Allow multiple faculty members (e.g. lab batches, co-teaching)
-- to be assigned to the same subject in a division/semester.
-- ============================================================

USE syllabus_tracker;

ALTER TABLE subject_assignments
  DROP INDEX uq_subject_assignment,
  ADD UNIQUE KEY uq_subject_assignment (subject_id, faculty_id, division_id, semester_id, academic_year_id);
