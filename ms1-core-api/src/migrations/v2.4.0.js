async function up(client) {
  // Add columns to medicines if they do not exist
  await client.query(`
    ALTER TABLE medicines 
    ADD COLUMN IF NOT EXISTS duration_value INTEGER,
    ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(20),
    ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_open_ended BOOLEAN DEFAULT FALSE;
  `);
}

module.exports = { up };
