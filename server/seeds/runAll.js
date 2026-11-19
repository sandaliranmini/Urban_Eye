const db = require('../config/db');
const seedCouncils = require('./seedCouncils');
const seedWards = require('./seedWards');
const seedCitizens = require('./seedCitizens');
const seedOfficers = require('./seedOfficers');
const seedIssues = require('./seedIssues');

// Children first. TRUNCATE also resets every AUTO_INCREMENT counter to 1.
const TABLES = [
  'VOTE', 'COMMENT', 'EMERGENCY_ALERT', 'REPORT_VERIFICATION', 'RESOLUTION_PROOF',
  'ANNOUNCEMENT', 'ISSUE', 'OFFICER', 'CITIZEN', 'WARD', 'COUNCIL',
];

// Empties every table so the seeders can always start from nothing
async function clearAll() {
  const conn = await db.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) await conn.query(`TRUNCATE TABLE \`${table}\``);
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();
  }
}

async function runAll() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('Refusing to wipe and re-seed a production database. Add --force if you really mean it.');
    process.exit(1);
  }

  console.log('Starting database seeding...\n');
  try {
    await clearAll();     // wipes ALL data, including issues created by hand
    await seedCouncils(); // Must be first
    await seedWards();    // Depends on Councils
    await seedCitizens(); // Depends on Wards
    await seedOfficers(); // Depends on Councils and Wards
    await seedIssues();   // Depends on Citizens and Wards

    console.log('\nAll seeders completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\nSeeding failed:', err);
    process.exit(1);
  }
}

runAll();