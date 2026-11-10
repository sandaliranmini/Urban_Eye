const test = require('node:test');
const assert = require('node:assert');
const { buildReminderEmail } = require('../templates/reminderEmail');
const { buildAutoCloseEmail } = require('../templates/autoCloseEmail');

test('Reminder Email Template - Day 7', () => {
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const email = buildReminderEmail({
    name: 'Saman Perera',
    title: 'Broken Streetlamp on Main Street',
    wardName: 'Ward 04 - Colombo Central',
    day: 7,
    deadlineAt: deadline,
    afterPhoto: 'https://res.cloudinary.com/test/lamp_fixed.jpg',
    officerRemarks: 'Repaired the faulty wiring and replaced bulb.',
    link: 'http://localhost:3000/issue/101',
  });

  assert.ok(email.subject.includes('[Reminder - 7 Days Left]'));
  assert.ok(email.subject.includes('Broken Streetlamp on Main Street'));
  assert.ok(email.text.includes('Hello Saman Perera'));
  assert.ok(email.text.includes('7 days remaining'));
  assert.ok(email.text.includes('Officer Remarks: Repaired the faulty wiring'));
  assert.ok(email.text.includes('http://localhost:3000/issue/101'));

  // HTML content checks
  assert.ok(email.html.includes('#2563eb')); // blue banner
  assert.ok(email.html.includes('Review &amp; Verify Resolution') || email.html.includes('Review & Verify Resolution'));
  assert.ok(email.html.includes('https://res.cloudinary.com/test/lamp_fixed.jpg'));
});

test('Reminder Email Template - Day 13 (Urgent final 24 hours)', () => {
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const email = buildReminderEmail({
    name: 'Kamal Silva',
    title: 'Clogged Drainage Ditch causing flooding',
    wardName: 'Ward 02',
    day: 13,
    deadlineAt: deadline,
    officerRemarks: 'Debris cleared and drain flushed.',
    link: 'http://localhost:3000/issue/102',
  });

  assert.ok(email.subject.includes('[URGENT - 24 Hours Left]'));
  assert.ok(email.text.includes('final reminder'));
  assert.ok(email.text.includes('24 hours remaining'));
  assert.ok(email.html.includes('#dc2626')); // urgent red banner
  assert.ok(email.html.includes('URGENT: Final 24 Hours to Respond'));
});

test('Auto-Close Email Template (14 days expired)', () => {
  const email = buildAutoCloseEmail({
    name: 'Nimali Fernando',
    title: 'Pothole near Hospital Junction',
    wardName: 'Ward 01',
    link: 'http://localhost:3000/issue/103',
  });

  assert.ok(email.subject.includes('has been automatically closed'));
  assert.ok(email.text.includes('Notice: Your reported issue has been automatically closed'));
  assert.ok(email.text.includes('14-day verification window'));
  assert.ok(email.html.includes('Auto Closed (14 Days)'));
  assert.ok(email.html.includes('http://localhost:3000/issue/103'));
});
