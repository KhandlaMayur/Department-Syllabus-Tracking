-- ============================================================
-- 020_create_syllabus_subtopics_table.sql
-- Subtopics table linked to syllabus units.
-- Each subtopic is stored individually.
-- ============================================================

USE syllabus_tracker;

CREATE TABLE IF NOT EXISTS syllabus_subtopics (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  unit_id      INT UNSIGNED NOT NULL,
  title        VARCHAR(255) NOT NULL,
  order_index  INT UNSIGNED NOT NULL DEFAULT 1,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_subtopic_unit (unit_id),
  KEY idx_subtopic_order (unit_id, order_index),

  CONSTRAINT fk_subtopic_unit
    FOREIGN KEY (unit_id) REFERENCES syllabus_units(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
