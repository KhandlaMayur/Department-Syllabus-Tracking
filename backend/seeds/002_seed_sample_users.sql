-- ============================================================
-- 002_seed_sample_users.sql
-- Sample registered users for development/testing.
-- Uses INSERT IGNORE so it is safe to re-run.
-- Passwords: none (Google OAuth only).
-- NOTE: replace example emails with real university emails
--       when testing against actual Google accounts.
-- ============================================================

USE syllabus_tracker;

-- Look up role IDs by name (safer than hardcoding IDs)
SET @role_student  = (SELECT id FROM roles WHERE name = 'student'  LIMIT 1);
SET @role_faculty  = (SELECT id FROM roles WHERE name = 'faculty'  LIMIT 1);
SET @role_cc       = (SELECT id FROM roles WHERE name = 'cc'       LIMIT 1);
SET @role_hod      = (SELECT id FROM roles WHERE name = 'hod'      LIMIT 1);
SET @dept_ce       = (SELECT id FROM departments WHERE code = 'CE' LIMIT 1);

-- -------------------------------------------------------
-- Sample student accounts (domain: @marwadiuniversity.ac.in)
-- google_id left NULL until first login
-- -------------------------------------------------------
INSERT IGNORE INTO users (google_id, name, email, role_id, department_id, is_active) VALUES
  (NULL, 'Mayur Khandla',  'mayur.khandla122265@marwadiuniversity.ac.in', @role_student, @dept_ce, 1),
  (NULL, 'Arjun Sharma',   'arjun.sharma@marwadiuniversity.ac.in',   @role_student, @dept_ce, 1),
  (NULL, 'Priya Patel',    'priya.patel@marwadiuniversity.ac.in',    @role_student, @dept_ce, 1),
  (NULL, 'Rohan Mehta',    'rohan.mehta@marwadiuniversity.ac.in',    @role_student, @dept_ce, 1),
  (NULL, 'Inactive Student', 'inactive.student@marwadiuniversity.ac.in', @role_student, @dept_ce, 0);

-- Matching students table rows
INSERT IGNORE INTO students (user_id, enrollment_number, semester, division, batch, is_active)
SELECT u.id, CONCAT('MU', LPAD(u.id, 6, '0')), 7, 'A', '2021-25', 1
FROM users u
WHERE u.email IN (
  'mayur.khandla122265@marwadiuniversity.ac.in',
  'arjun.sharma@marwadiuniversity.ac.in',
  'priya.patel@marwadiuniversity.ac.in',
  'rohan.mehta@marwadiuniversity.ac.in'
);

-- Inactive student (is_active=0 in students too)
INSERT IGNORE INTO students (user_id, enrollment_number, semester, division, batch, is_active)
SELECT u.id, 'MU999999', 5, 'B', '2022-26', 0
FROM users u WHERE u.email = 'inactive.student@marwadiuniversity.ac.in';

-- -------------------------------------------------------
-- Sample faculty accounts (domain: @marwadieducation.edu.in)
-- -------------------------------------------------------
INSERT IGNORE INTO users (google_id, name, email, role_id, department_id, is_active) VALUES
  (NULL, 'Dr. Chandrasinh Parmar', 'chandrasinh.parmar@marwadieducation.edu.in', @role_hod,     @dept_ce, 1),
  (NULL, 'Dr. Amit Joshi',         'amit.joshi@marwadieducation.edu.in',         @role_faculty, @dept_ce, 1),
  (NULL, 'Prof. Sara Khan',        'sara.khan@marwadieducation.edu.in',          @role_cc,      @dept_ce, 1),
  (NULL, 'Dr. Vimal Shah',         'vimal.shah@marwadieducation.edu.in',         @role_hod,     @dept_ce, 1);

-- Matching faculty table rows
INSERT IGNORE INTO faculty (user_id, employee_id, designation, is_active)
SELECT u.id,
       CONCAT('EMP', LPAD(u.id, 5, '0')),
       CASE u.email
         WHEN 'chandrasinh.parmar@marwadieducation.edu.in' THEN 'Head of Department'
         WHEN 'amit.joshi@marwadieducation.edu.in'         THEN 'Assistant Professor'
         WHEN 'sara.khan@marwadieducation.edu.in'          THEN 'Course Coordinator'
         WHEN 'vimal.shah@marwadieducation.edu.in'         THEN 'Head of Department'
       END,
       1
FROM users u
WHERE u.email IN (
  'chandrasinh.parmar@marwadieducation.edu.in',
  'amit.joshi@marwadieducation.edu.in',
  'sara.khan@marwadieducation.edu.in',
  'vimal.shah@marwadieducation.edu.in'
);
