-- ============================================================
-- 007_create_staff_roles_table.sql
-- Fine-grained role assignments for staff (faculty/hod/cc).
-- Supports department-scoped roles and future multi-role.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS staff_roles (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  role_id       INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED DEFAULT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  assigned_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_staff_role_dept (user_id, role_id, department_id),

  CONSTRAINT fk_staff_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_staff_roles_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_staff_roles_dept
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
