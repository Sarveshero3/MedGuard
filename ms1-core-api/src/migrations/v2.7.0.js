module.exports = {
  up: async (dbClient) => {
    await dbClient.query(`
      ALTER TABLE medicines ALTER COLUMN source_photo_id TYPE TEXT;
      ALTER TABLE lab_reports ALTER COLUMN source_photo_id TYPE TEXT;
    `);
  }
};
