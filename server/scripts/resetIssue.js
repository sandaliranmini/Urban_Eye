   require('dotenv').config();
   const pool = require('../config/db');

   (async () => {
     const id = Number(process.argv[2]) || 6;
     const [result] = await pool.query(
       "UPDATE ISSUE SET STATUS = 'Open' WHERE ISSUE_ID = ?",
       [id]
     );
     console.log(`Issue ${id} reset to Open (rows changed: ${result.affectedRows})`);
     await pool.end();
   })();