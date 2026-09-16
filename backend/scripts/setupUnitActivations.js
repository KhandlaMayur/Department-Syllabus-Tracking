require('dotenv').config();
const { pool } = require('../src/config/db');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS unit_activations (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        unit_id       INT UNSIGNED NOT NULL,
        subject_id    INT UNSIGNED NOT NULL,
        batch_id      INT UNSIGNED NOT NULL,
        division_id   INT UNSIGNED DEFAULT NULL,
        activated_by  INT UNSIGNED NOT NULL,
        activated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY uq_unit_batch_activation (unit_id, batch_id),
        INDEX idx_ua_subject (subject_id),
        INDEX idx_ua_batch (batch_id),

        CONSTRAINT fk_ua_unit FOREIGN KEY (unit_id) REFERENCES syllabus_units(id) ON DELETE CASCADE,
        CONSTRAINT fk_ua_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ua_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT,
        CONSTRAINT fk_ua_user FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('unit_activations table created successfully!');
    process.exit(0);
  } catch (e) {
    console.error('Error creating unit_activations table:', e);
    process.exit(1);
  }
}

run();
