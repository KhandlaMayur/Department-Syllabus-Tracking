-- ============================================================
-- 019_create_timetable_system.sql
-- Phase 5: Production-level Timetable Management System
-- Multi-format timetable import (PDF, Excel, Image)
-- Roles, versions, entries, faculty mappings, audit logs
-- ============================================================

USE syllabus_tracker;

-- 1. Add faculty_initial to faculty table if not exists
ALTER TABLE faculty
  ADD COLUMN IF NOT EXISTS faculty_initial VARCHAR(20) DEFAULT NULL AFTER employee_id;

-- 2. Create timetables parent table
CREATE TABLE IF NOT EXISTS timetables (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id INT UNSIGNED NOT NULL,
  semester_id      INT UNSIGNED NOT NULL,
  division_id      INT UNSIGNED DEFAULT NULL,
  department_id    INT UNSIGNED DEFAULT NULL,
  file_name        VARCHAR(255) NOT NULL,
  file_type        VARCHAR(100) DEFAULT NULL,
  file_path        VARCHAR(500) DEFAULT NULL,
  uploaded_by      INT UNSIGNED NOT NULL,
  uploaded_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status           ENUM('active', 'archived', 'draft') NOT NULL DEFAULT 'active',
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  source_format    ENUM('pdf', 'excel', 'image') NOT NULL DEFAULT 'pdf',
  notes            TEXT DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tt_academic_year (academic_year_id),
  INDEX idx_tt_semester (semester_id),
  INDEX idx_tt_division (division_id),
  INDEX idx_tt_department (department_id),
  INDEX idx_tt_status (status),
  INDEX idx_tt_uploaded_by (uploaded_by),

  CONSTRAINT fk_tt_academic_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_tt_semester
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_tt_division
    FOREIGN KEY (division_id) REFERENCES divisions(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_tt_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_tt_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create timetable_entries child table
CREATE TABLE IF NOT EXISTS timetable_entries (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timetable_id     INT UNSIGNED NOT NULL,
  day              ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
  start_time       VARCHAR(10) NOT NULL,
  end_time         VARCHAR(10) NOT NULL,
  duration_minutes INT UNSIGNED DEFAULT 55,
  subject_id       INT UNSIGNED DEFAULT NULL,
  subject_code_raw VARCHAR(50) DEFAULT NULL,
  subject_name_raw VARCHAR(255) DEFAULT NULL,
  faculty_id       INT UNSIGNED DEFAULT NULL,
  faculty_initial  VARCHAR(50) DEFAULT NULL,
  room             VARCHAR(100) DEFAULT NULL,
  entry_type       ENUM('lecture', 'lab', 'tutorial', 'practical', 'other') NOT NULL DEFAULT 'lecture',
  period_number    TINYINT UNSIGNED DEFAULT NULL,
  batch_group      VARCHAR(10) DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tte_timetable (timetable_id),
  INDEX idx_tte_day (day),
  INDEX idx_tte_subject (subject_id),
  INDEX idx_tte_faculty (faculty_id),
  INDEX idx_tte_faculty_initial (faculty_initial),
  INDEX idx_tte_batch_group (batch_group),

  CONSTRAINT fk_tte_timetable
    FOREIGN KEY (timetable_id) REFERENCES timetables(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_tte_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_tte_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create faculty_initials mapping lookup table
CREATE TABLE IF NOT EXISTS faculty_initials (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  initials      VARCHAR(20) NOT NULL,
  faculty_id    INT UNSIGNED DEFAULT NULL,
  faculty_name  VARCHAR(255) DEFAULT NULL,
  department_id INT UNSIGNED DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_initial_dept (initials, department_id),
  INDEX idx_fi_faculty (faculty_id),

  CONSTRAINT fk_fi_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_fi_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create timetable_import_logs table for auditing
CREATE TABLE IF NOT EXISTS timetable_import_logs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timetable_id    INT UNSIGNED DEFAULT NULL,
  uploaded_by     INT UNSIGNED NOT NULL,
  action          VARCHAR(50) NOT NULL,
  result          ENUM('success', 'failed', 'warning') NOT NULL DEFAULT 'success',
  subjects_count  INT UNSIGNED DEFAULT 0,
  entries_count   INT UNSIGNED DEFAULT 0,
  conflicts_count INT UNSIGNED DEFAULT 0,
  message         TEXT DEFAULT NULL,
  details         JSON DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_til_timetable (timetable_id),
  INDEX idx_til_uploaded_by (uploaded_by),

  CONSTRAINT fk_til_timetable
    FOREIGN KEY (timetable_id) REFERENCES timetables(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_til_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
