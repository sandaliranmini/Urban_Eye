const seedCouncils = require('./seedCouncils');
const seedWards = require('./seedWards');
const seedCitizens = require('./seedCitizens');
const seedOfficers = require('./seedOfficers');

async function runAll() {
  console.log('🌱 Starting database seeding...\n');
  try {
    await seedCouncils(); // Must be first
    await seedWards();    // Depends on Councils
    await seedCitizens(); // Depends on Wards
    await seedOfficers(); // Depends on Councils and Wards
    
    console.log('\n All seeders completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n Seeding failed:', err);
    process.exit(1);
  }
}

runAll();