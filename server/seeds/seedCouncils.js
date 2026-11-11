const db = require('../config/db');

// This deployment serves one council: Dompe Pradeshiya Sabha.
// It becomes COUNCIL_ID 1 because the auto-increment counter is reset below.
async function seedCouncils() {
  const councils = [
    { name: 'Dompe Pradeshiya Sabha', type: 'Pradeshiya Sabha', district: 'Gampaha', province: 'Western' },
  ];

  try {
    await db.query('DELETE FROM COUNCIL');
    await db.query('ALTER TABLE COUNCIL AUTO_INCREMENT = 1');

    for (const c of councils) {
      await db.query(
        'INSERT INTO COUNCIL (COUNCIL_NAME, COUNCIL_TYPE, DISTRICT, PROVINCE) VALUES (?, ?, ?, ?)',
        [c.name, c.type, c.district, c.province]
      );
    }
    console.log(`Seeded ${councils.length} council: ${councils[0].name}`);
  } catch (err) {
    console.error('Council seed failed:', err.message);
    throw err; // stop the whole seed here instead of failing later with confusing errors
  }
}

module.exports = seedCouncils;