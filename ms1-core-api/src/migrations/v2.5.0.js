async function up(client) {
  // Drop the is_ongoing and is_open_ended columns, replaced by is_lifetime
  await client.query(`
    ALTER TABLE medicines 
    DROP COLUMN IF EXISTS is_ongoing,
    DROP COLUMN IF EXISTS is_open_ended;
  `);

  await client.query(`
    ALTER TABLE medicines 
    ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

module.exports = { up };
