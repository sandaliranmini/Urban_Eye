require('dotenv').config();
const pool = require('../config/db');
const { notifyStatusChange } = require('../services/notificationService');

(async () => {
  const issueId = Number(process.argv[2]);
  const newStatus = process.argv[3] || 'In Progress';
  if (!issueId) {
    console.log('Usage: node scripts/testNotification.js <issueId> [newStatus]');
    process.exit(1);
  }
  await notifyStatusChange(issueId, 'Open', newStatus, { note: 'This is a test note.' });
  await pool.end();
})();
