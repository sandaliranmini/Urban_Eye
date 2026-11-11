const db = require('../config/db');

// The 25 wards of Dompe Pradeshiya Sabha, in the official order (ward number 1 to 25).
// Source: Ward Map of Dompe Pradeshiya Sabha - Gampaha District (Ref. No NDC/02/17),
// prepared by the Survey Department of Sri Lanka for the National Delimitation Committee
// for Local Authorities (2013/2016), Ministry of Local Government and Provincial Councils.
const DOMPE_WARDS = [
  'Wathurugama',    // 1
  'Diyawala',       // 2
  'Millathe',       // 3
  'Udagama',        // 4
  'Meethirigala',   // 5
  'Kirindiwela',    // 6
  'Radawana',       // 7
  'Nedungolla',     // 8
  'Pepiliyawala',   // 9
  'Ganihigama',     // 10
  'Dangalla',       // 11
  'Pugoda',         // 12
  'Pelpita',        // 13
  'Mandawala',      // 14
  'Keragala',       // 15
  'Demalagama',     // 16
  'Kalukondayawa',  // 17
  'Dekatana',       // 18
  'Pelahela',       // 19
  'Lunugama',       // 20
  'Giridara',       // 21
  'Samanabedda',    // 22
  'Iddamaldeniya',  // 23
  'Dompe',          // 24
  'Mapitigama',     // 25
];

const COUNCIL_ID = 1; // Dompe Pradeshiya Sabha (the only council seeded by seedCouncils.js)

async function seedWards() {
  try {
    await db.query('DELETE FROM WARD');
    await db.query('ALTER TABLE WARD AUTO_INCREMENT = 1');

    // inserted in order, so WARD_ID follows the official ward numbers
    for (const [index, name] of DOMPE_WARDS.entries()) {
      await db.query(
        'INSERT INTO WARD (COUNCIL_ID, WARD_NAME, DESCRIPTION) VALUES (?, ?, ?)',
        [COUNCIL_ID, name, `Ward ${index + 1} of Dompe Pradeshiya Sabha`]
      );
    }
    console.log(`Seeded ${DOMPE_WARDS.length} wards for Dompe Pradeshiya Sabha`);
  } catch (err) {
    console.error('Ward seed failed:', err.message);
    throw err;
  }
}

module.exports = seedWards;