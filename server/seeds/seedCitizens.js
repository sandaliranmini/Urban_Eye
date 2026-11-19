const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');

// IMPORTANT: this must match how routes/authRoutes.js hashes a NIC.
// If the two differ, seeded citizens can never log in with their NIC.
function hashNic(nic) {
  if (!process.env.NIC_HASH_SECRET) throw new Error('NIC_HASH_SECRET is not set in .env');
  return crypto
    .createHmac('sha256', process.env.NIC_HASH_SECRET)
    .update(String(nic).trim().toUpperCase())
    .digest('hex');
}

async function seedCitizens() {
  // wards 1 and 2 are Wathurugama and Diyawala (the first wards of Dompe Pradeshiya Sabha)
  const citizens = [
    { ward_id: 1, nic: '199012345678', name: 'Amandi Citizen', email: 'amandi@citizen.lk', mobile: '0771234567', pass: 'Amandi@123' },
    { ward_id: 2, nic: '199056789012', name: 'John Doe', email: 'john@citizen.lk', mobile: '0712345678', pass: 'John@123' },
  ];

  try {
    await db.query('DELETE FROM CITIZEN');
    await db.query('ALTER TABLE CITIZEN AUTO_INCREMENT = 1');

    for (const c of citizens) {
      const hash = await bcrypt.hash(c.pass, 10);
      await db.query(
        `INSERT INTO CITIZEN (WARD_ID, NIC_HASH, FULL_NAME, EMAIL, MOBILE_NUMBER, PASSWORD_HASH)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [c.ward_id, hashNic(c.nic), c.name, c.email, c.mobile, hash]
      );
    }
    console.log(`Seeded ${citizens.length} citizens`);
  } catch (err) {
    console.error('Citizen seed failed:', err.message);
    throw err; // stop the whole seed instead of reporting success
  }
}

module.exports = seedCitizens;