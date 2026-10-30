const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,          // (Use 3306, since XAMPP usually resets to this)
  user: 'root',        // HARDCODED USER
  password: '',        // HARDCODED EMPTY PASSWORD
  database: 'URBAN_EYE',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;