-- ============================================================
-- 004_create_users_table.sql
-- Core users table. Authentication is Google OAuth only (no
-- password column) — google_id is the durable identity anchor.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id       VARCHAR(50) DEFAULT NULL,   -- NULL until first login; backfilled by auth service
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(190) NOT NULL,
  avatar_url      VARCHAR(500) DEFAULT NULL,
  role_id         INT UNSIGNED NOT NULL,
  department_id   INT UNSIGNED DEFAULT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at   DATETIME DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_google_id (google_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_id (role_id),
  KEY idx_users_department_id (department_id),

  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
