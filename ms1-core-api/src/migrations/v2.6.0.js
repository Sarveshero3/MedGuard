async function up(client) {
  await client.query(`
    ALTER TABLE caregiver_links 
    ADD COLUMN IF NOT EXISTS permission_level VARCHAR(25) NOT NULL DEFAULT 'full_view';
  `);
}

module.exports = { up };
