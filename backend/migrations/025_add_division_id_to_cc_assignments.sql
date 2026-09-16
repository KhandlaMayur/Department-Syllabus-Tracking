-- ============================================================
-- 025_add_division_id_to_cc_assignments.sql
-- Enables assigning Class Coordinators (CC) by Batch and Division
-- ============================================================

USE syllabus_tracker;

ALTER TABLE cc_assignments
  ADD COLUMN IF NOT EXISTS division_id INT UNSIGNED DEFAULT NULL AFTER batch_id,
  DROP INDEX IF EXISTS uq_cc_assignment_batch,
  ADD UNIQUE KEY IF NOT EXISTS uq_cc_batch_division (batch_id, division_id),
  ADD INDEX IF NOT EXISTS idx_cc_division (division_id);
