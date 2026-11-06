const db = require('../config/db');

async function seedWards() {
  const wards = [
    { name: 'Imbulpe', council_id: 1 },
    { name: 'Seelogama', council_id: 1 },
    { name: 'Galagama', council_id: 1 },
    { name: 'Gampaha', council_id: 2 },
    { name: 'Medagama', council_id: 2 },
    { name: 'Kandy Central', council_id: 3 },
  ];

  try {
    await db.query('DELETE FROM WARD');
    await db.query('ALTER TABLE WARD AUTO_INCREMENT = 1');

    for (const w of wards) {
      await db.query(
        'INSERT INTO WARD (COUNCIL_ID, WARD_NAME, DESCRIPTION) VALUES (?, ?, ?)', 
        [w.council_id, w.name, `Description for ${w.name}`]
      );
    }
    console.log(`Seeded ${wards.length} wards`);
  } catch (err) {
    console.error('Ward seed failed:', err.message);
  }
}

module.exports = seedWards;
