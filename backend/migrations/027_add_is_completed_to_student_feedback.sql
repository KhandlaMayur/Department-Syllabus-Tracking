-- ============================================================
-- 027_add_is_completed_to_student_feedback.sql
-- Add is_completed flag to student_feedback to track marked as done
-- ============================================================

USE syllabus_tracker;

ALTER TABLE student_feedback
  ADD COLUMN IF NOT EXISTS is_completed TINYINT(1) NOT NULL DEFAULT 1 AFTER comment;