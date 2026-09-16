-- ============================================================
-- 014_create_subject_assignments_table.sql
-- Maps a subject to a faculty member for a specific division +
-- semester + academic year. Prevents duplicate assignments.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS subject_assignments (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id       INT UNSIGNED NOT NULL,
  faculty_id       INT UNSIGNED NOT NULL COMMENT 'references faculty.id',
  division_id      INT UNSIGNED NOT NULL,
  semester_id      INT UNSIGNED NOT NULL,
  academic_year_id INT UNSIGNED NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Prevent the same subject being assigned twice to the same division/semester/year
  UNIQUE KEY uq_subject_assignment (subject_id, division_id, semester_id, academic_year_id),

  INDEX idx_sa_subject       (subject_id),
  INDEX idx_sa_faculty       (faculty_id),
  INDEX idx_sa_division      (division_id),
  INDEX idx_sa_semester      (semester_id),
  INDEX idx_sa_academic_year (academic_year_id),
  INDEX idx_sa_active        (is_active),

  CONSTRAINT fk_sa_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_sa_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_sa_division
    FOREIGN KEY (division_id) REFERENCES divisions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_sa_semester
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_sa_academic_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
