async function up(client) {
  // 1. Add columns to brand_generic_map if they do not exist
  await client.query(`
    ALTER TABLE brand_generic_map 
    ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(50) NOT NULL DEFAULT 'resolved',
    ADD COLUMN IF NOT EXISTS resolution_source VARCHAR(255) NOT NULL DEFAULT 'seed',
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  // 2. Identify corrupted entries created when using the wrong model
  const { rows: corruptedRows } = await client.query(`
    SELECT DISTINCT brand_name 
    FROM brand_generic_map 
    WHERE source = 'vlm_resolved' AND generic_name = 'no such medicine found'
  `);

  if (corruptedRows.length === 0) {
    return;
  }

  // 3. For each corrupted brand name, append a new row marked as unresolved_error
  for (const row of corruptedRows) {
    const brand = row.brand_name;

    // Get the maximum version number for this brand
    const { rows: versionRows } = await client.query(
      'SELECT version FROM brand_generic_map WHERE brand_name = $1 ORDER BY effective_date DESC LIMIT 1',
      [brand]
    );

    let nextVersion = 'v1';
    if (versionRows.length > 0) {
      const currentVersion = versionRows[0].version;
      const currentNum = parseInt(currentVersion.replace('v', ''), 10) || 1;
      nextVersion = `v${currentNum + 1}`;
    }

    // Insert the new unresolved_error entry to supersede the corrupted one without mutation of old data
    await client.query(
      `INSERT INTO brand_generic_map (
        brand_name, 
        generic_name, 
        source, 
        version, 
        effective_date, 
        resolution_status, 
        resolution_source, 
        resolved_at
      ) VALUES ($1, $2, 'vlm_resolved', $3, NOW(), 'unresolved_error', 'failed_fallback_gpt4o_mini_retag', NOW())
      ON CONFLICT (brand_name, version) DO NOTHING`,
      [brand, 'no such medicine found', nextVersion]
    );
  }
}

module.exports = { up };
