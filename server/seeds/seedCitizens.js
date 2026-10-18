const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedCitizens() {
  const citizens = [
    { ward_id: 1, nic: '199012345678', name: 'Amandi Citizen', email: 'amandi@citizen.lk', mobile: '0771234567', pass: 'Amandi@123' },
    { ward_id: 2, nic: '199098765432', name: 'John Doe', email: 'john@citizen.lk', mobile: '0712345678', pass: 'John@123' },
  ];

  try {
    await db.query('DELETE FROM CITIZEN');
    await db.query('ALTER TABLE CITIZEN AUTO_INCREMENT = 1');

    for (const c of citizens) {
      const hash = await bcrypt.hash(c.pass, 10);
      // We hash the NIC because the schema requires NIC_HASH
      const nicHash = require('crypto').createHash('sha256').update(c.nic).digest('hex');

      await db.query(
        `INSERT INTO CITIZEN (WARD_ID, NIC_HASH, FULL_NAME, EMAIL, MOBILE_NUMBER, PASSWORD_HASH) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [c.ward_id, nicHash, c.name, c.email, c.mobile, hash]
      );
    }
    console.log(`Seeded ${citizens.length} citizens`);
  } catch (err) {
    console.error('Citizen seed failed:', err.message);
  }
}

module.exports = seedCitizens;
