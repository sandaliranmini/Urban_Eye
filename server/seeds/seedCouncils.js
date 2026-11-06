const db = require('../config/db');

async function seedCouncils() {
  const councils = [
    { name: 'Balangoda Urban Council', district: 'Colombo', province: 'Western' },
    { name: 'Gampaha Urban Council', district: 'Kandy', province: 'Central' },
    { name: 'Kandy Urban Council', district: 'Galle', province: 'Southern' },
  ];

  try {
    await db.query('DELETE FROM COUNCIL');
    await db.query('ALTER TABLE COUNCIL AUTO_INCREMENT = 1');

    for (const c of councils) {
      await db.query(
        'INSERT INTO COUNCIL (COUNCIL_NAME, COUNCIL_TYPE, DISTRICT, PROVINCE) VALUES (?, ?, ?, ?)', 
        [c.name, 'Urban Council', c.district, c.province]
      );
    }
    console.log(`Seeded ${councils.length} councils`);
  } catch (err) {
    console.error('Council seed failed:', err.message);
  }
}

module.exports = seedCouncils;