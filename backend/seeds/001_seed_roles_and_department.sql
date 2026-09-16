-- ============================================================
-- 001_seed_roles_and_department.sql
-- Default roles required by the app logic + a starter department row.
-- Safe to re-run (INSERT IGNORE).
-- ============================================================

USE syllabus_tracker;

INSERT IGNORE INTO roles (name, description) VALUES
  ('student', 'Can view syllabus progress for their enrolled subjects'),
  ('faculty', 'Can update topic completion status for assigned subjects'),
  ('cc',      'Course Coordinator — oversees subjects within a department'),
  ('hod',     'Head of Department — full visibility across the department');

INSERT IGNORE INTO departments (name, code) VALUES
  ('Computer Engineering', 'CE');
