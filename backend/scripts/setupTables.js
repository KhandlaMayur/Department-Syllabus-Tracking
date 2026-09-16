require('dotenv').config();
const { pool } = require('../src/config/db');

async function initTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS topic_completions (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        subtopic_id     INT UNSIGNED NOT NULL,
        subject_id      INT UNSIGNED NOT NULL,
        batch_id        INT UNSIGNED NOT NULL,
        division_id     INT UNSIGNED DEFAULT NULL,
        semester_number TINYINT UNSIGNED NOT NULL,
        completed_by    INT UNSIGNED NOT NULL COMMENT 'references users.id',
        completed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_topic_completion (subtopic_id, batch_id),
        INDEX idx_tc_subject (subject_id),
        INDEX idx_tc_batch (batch_id),
        INDEX idx_tc_division (division_id),
        INDEX idx_tc_completed_by (completed_by),

        CONSTRAINT fk_tc_subtopic
          FOREIGN KEY (subtopic_id) REFERENCES syllabus_subtopics(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_tc_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_tc_batch
          FOREIGN KEY (batch_id) REFERENCES batches(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,

        CONSTRAINT fk_tc_completed_by
          FOREIGN KEY (completed_by) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_feedback (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        subtopic_id     INT UNSIGNED NOT NULL,
        subject_id      INT UNSIGNED NOT NULL,
        student_id      INT UNSIGNED NOT NULL COMMENT 'references users.id',
        batch_id        INT UNSIGNED NOT NULL,
        division_id     INT UNSIGNED DEFAULT NULL,
        semester_number TINYINT UNSIGNED NOT NULL,
        faculty_id      INT UNSIGNED DEFAULT NULL COMMENT 'references users.id',
        rating          TINYINT UNSIGNED NOT NULL COMMENT '1 to 5',
        comment         TEXT DEFAULT NULL,
        created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_student_feedback (subtopic_id, student_id, batch_id),
        INDEX idx_sf_subject (subject_id),
        INDEX idx_sf_student (student_id),
        INDEX idx_sf_batch (batch_id),
        INDEX idx_sf_faculty (faculty_id),

        CONSTRAINT fk_sf_subtopic
          FOREIGN KEY (subtopic_id) REFERENCES syllabus_subtopics(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_sf_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_sf_student
          FOREIGN KEY (student_id) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_sf_batch
          FOREIGN KEY (batch_id) REFERENCES batches(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,

        CONSTRAINT fk_sf_faculty
          FOREIGN KEY (faculty_id) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cc_feedback (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        subtopic_id     INT UNSIGNED NOT NULL,
        subject_id      INT UNSIGNED NOT NULL,
        batch_id        INT UNSIGNED NOT NULL,
        division_id     INT UNSIGNED DEFAULT NULL,
        semester_number TINYINT UNSIGNED NOT NULL,
        faculty_id      INT UNSIGNED NOT NULL COMMENT 'references users.id — CC faculty who gave feedback',
        rating          TINYINT UNSIGNED NOT NULL COMMENT '1 to 5',
        comment         TEXT DEFAULT NULL,
        created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_ccfb_subtopic_batch (subtopic_id, batch_id),
        INDEX idx_ccfb_subject_batch (subject_id, batch_id),
        INDEX idx_ccfb_faculty (faculty_id),

        CONSTRAINT fk_ccfb_subtopic
          FOREIGN KEY (subtopic_id) REFERENCES syllabus_subtopics(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_ccfb_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_ccfb_faculty
          FOREIGN KEY (faculty_id) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_ccfb_batch
          FOREIGN KEY (batch_id) REFERENCES batches(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Tables initialized successfully!');
    process.exit(0);
  } catch (e) {
    console.error('Error initializing tables:', e);
    process.exit(1);
  }
}

initTables();
