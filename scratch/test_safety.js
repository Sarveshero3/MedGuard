const path = require('path');
// Set up process env database URL
process.env.DATABASE_URL = 'postgresql://medguard:medguard_dev@localhost:5432/medguard';
process.env.MS2_BASE_URL = 'http://localhost:8000';

const brandResolutionService = require('../ms1-core-api/src/services/brandResolutionService');
const { query } = require('../ms1-core-api/src/config/db');

async function runTests() {
  console.log('--- STARTING VERIFICATION TESTS ---');

  const testBrand = 'TestBrandUnconfirmed-' + Date.now();
  console.log(`\n1. Resolving brand '${testBrand}' (initial lookup)...`);
  
  // Resolve brand (which will hit MS2 and should not write any resolved mapping to DB)
  const result = await brandResolutionService.resolveBrand(testBrand);
  console.log('Result:', result);

  // Check database
  const dbCheck = await query('SELECT * FROM brand_generic_map WHERE brand_name = $1', [testBrand]);
  console.log(`DB Rows count: ${dbCheck.rows.length}`);
  if (dbCheck.rows.length === 0) {
    console.log('✅ PASS: No cache row was written for successful/candidate resolution!');
  } else {
    console.log('❌ FAIL: Cache row was written:', dbCheck.rows[0]);
  }

  // 2. Simulate Save & Link Records (User Confirmed)
  console.log(`\n2. Committing mapping as user_confirmed...`);
  await brandResolutionService.saveCorrection({
    brandName: testBrand,
    genericName: 'testgeneric',
    resolutionSource: 'user_confirmed'
  });

  const dbCheckConfirmed = await query(
    'SELECT * FROM brand_generic_map WHERE brand_name = $1 ORDER BY effective_date DESC LIMIT 1',
    [testBrand]
  );
  if (dbCheckConfirmed.rows.length > 0) {
    const row = dbCheckConfirmed.rows[0];
    console.log(`Inserted row: version=${row.version}, resolution_status=${row.resolution_status}, resolution_source=${row.resolution_source}`);
    if (row.resolution_status === 'resolved' && row.resolution_source === 'user_confirmed' && row.version === 'v1') {
      console.log('✅ PASS: Confirmed mapping successfully committed as resolved / user_confirmed!');
    } else {
      console.log('❌ FAIL: Incorrect row attributes!');
    }
  } else {
    console.log('❌ FAIL: No row found!');
  }

  // 3. Simulate Save & Link Records (User Corrected)
  console.log(`\n3. Committing correction as user_correction...`);
  await brandResolutionService.saveCorrection({
    brandName: testBrand,
    genericName: 'differentgeneric',
    resolutionSource: 'user_correction'
  });

  const dbCheckCorrected = await query(
    'SELECT * FROM brand_generic_map WHERE brand_name = $1 ORDER BY effective_date DESC',
    [testBrand]
  );
  console.log(`DB Rows count after correction: ${dbCheckCorrected.rows.length}`);
  if (dbCheckCorrected.rows.length === 2) {
    const row = dbCheckCorrected.rows[0]; // most recent is first
    console.log(`New row: version=${row.version}, resolution_status=${row.resolution_status}, resolution_source=${row.resolution_source}`);
    if (row.resolution_status === 'resolved' && row.resolution_source === 'user_correction' && row.version === 'v2') {
      console.log('✅ PASS: Correction successfully committed append-only as v2 / user_correction!');
    } else {
      console.log('❌ FAIL: Incorrect row attributes!');
    }
  } else {
    console.log('❌ FAIL: Incorrect row count!');
  }

  // 4. Test not_found_unconfirmed caching
  const deadEndBrand = 'DeadEndBrand-' + Date.now();
  console.log(`\n4. Resolving dead-end brand '${deadEndBrand}' (no match)...`);
  // Calling resolveBrand for a nonexistent brand will get no such medicine found
  const nfResult = await brandResolutionService.resolveBrand(deadEndBrand);
  console.log('Result:', nfResult);

  const nfCheck = await query('SELECT * FROM brand_generic_map WHERE brand_name = $1', [deadEndBrand]);
  if (nfCheck.rows.length > 0) {
    const row = nfCheck.rows[0];
    console.log(`Inserted row: resolution_status=${row.resolution_status}, resolution_source=${row.resolution_source}`);
    if (row.resolution_status === 'not_found_unconfirmed') {
      console.log('✅ PASS: Unconfirmed negative cached as not_found_unconfirmed!');
    } else {
      console.log('❌ FAIL: Incorrect resolution_status!');
    }
  } else {
    console.log('❌ FAIL: No cache row written!');
  }

  console.log('\n--- VERIFICATION COMPLETED ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
