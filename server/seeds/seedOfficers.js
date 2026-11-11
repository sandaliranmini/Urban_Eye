const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedOfficers() {
  // council 1 is Dompe Pradeshiya Sabha, ward 1 is Wathurugama
  const officers = [
    { council_id: 1, ward_id: 1, emp_id: 'EMP-001', name: 'Dompe PS Admin', email: 'admin@dompeps.test', pass: 'Admin@123', role: 'Admin' },
    { council_id: 1, ward_id: 1, emp_id: 'EMP-002', name: 'Field Officer 1', email: 'field1@dompeps.test', pass: 'Field@123', role: 'Field Officer' },
  ];

  try {
    await db.query('DELETE FROM OFFICER');
    await db.query('ALTER TABLE OFFICER AUTO_INCREMENT = 1');

    for (const o of officers) {
      const hash = await bcrypt.hash(o.pass, 10);
      await db.query(
        `INSERT INTO OFFICER (COUNCIL_ID, WARD_ID, EMPLOYEE_ID, FULL_NAME, EMAIL, PASSWORD_HASH, ROLE)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [o.council_id, o.ward_id, o.emp_id, o.name, o.email, hash, o.role]
      );
    }
    console.log(`Seeded ${officers.length} officers`);
  } catch (err) {
    console.error('Officer seed failed:', err.message);
    throw err; // stop the whole seed instead of reporting success
  }
}

module.exports = seedOfficers;