/**
 Sri Lankan NIC Validator
  
 1 There are two types of NIC formats:
  Old NIC(9 digits and one letter (V or X)).
  New NIC: 12 digits.
  
 2 NIC details:
  YY/YYYY (Birth year).
  DDD (Day of the year).
  500 is added to the day number for females.
  SSS/SSSS: Serial number.
  C: Check digit.
 
 3 Day number validation:
   February is considered as having 29 days for NIC day numbers.
   Day 060 represents 29 February.
   Day 060 is not valid for a person born in a non-leap year.
 
4 Check digit:
  The check digit is not validated because its algorithm is not publicly documented.

5 What does this validator check?
  NIC format.
  Birth year.
  Valid day number.
  Future birth dates.
  Minimum age, if required.
 
6 How to use:
  Import validateNic, isValidNic, and canonicalNic.
  Pass an NIC number to validateNic().
  The result includes validity, format, gender, birth date, age, NIC-12 format, error, and message.
 
7 How to run the tests:
  Run the command: node nicValidator.js
 
8 This file works without any external dependencies.
 */
'use strict';

// NIC numbering treats February as 29 days in every year
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MIN_BIRTH_YEAR = 1900;

const MESSAGES = {
  EMPTY: 'Please enter your NIC number.',
  FORMAT: 'NIC must be 9 digits followed by V or X, or exactly 12 digits.',
  YEAR: 'The birth year in this NIC is not valid.',
  DAY: 'The birth day in this NIC is not valid.',
  FUTURE: 'The birth date in this NIC is in the future.',
  UNDERAGE: 'You do not meet the minimum age for this service.',
};

const OLD_FORMAT = /^\d{9}[VX]$/;
const NEW_FORMAT = /^\d{12}$/;

const pad = (num, len) => String(num).padStart(len, '0');
const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

//Trim, remove spaces, uppercase the V/X. 
function normalizeNic(nic) {
  return String(nic == null ? '' : nic).replace(/\s+/g, '').toUpperCase();
}

function fail(error, nic) {
  return { valid: false, nic, error, message: MESSAGES[error] };
}

/**Validate a NIC and decode it.
  @param {string} nic
  @param {{ now?: Date, minAge?: number }} [options]
 */
function validateNic(nic, options = {}) {
  const { now = new Date(), minAge = 0 } = options;
  const n = normalizeNic(nic);

  if (!n) return fail('EMPTY', n);

  let format, year, dayCode, serial, check;
  if (OLD_FORMAT.test(n)) {
    format = 'old';
    year = 1900 + Number(n.slice(0, 2));
    dayCode = Number(n.slice(2, 5));
    serial = n.slice(5, 8); // YY(2) DDD(3) SSS(3) C(1) then the V/X letter
    check = n[8];
  } else if (NEW_FORMAT.test(n)) {
    format = 'new';
    year = Number(n.slice(0, 4));
    dayCode = Number(n.slice(4, 7));
    serial = n.slice(7, 11);
    check = n[11];
  } else {
    return fail('FORMAT', n);
  }

  if (year < MIN_BIRTH_YEAR || year > now.getFullYear()) return fail('YEAR', n);

  //500 is added to the day for females
  const female = dayCode > 500;
  const dayOfYear = female ? dayCode - 500 : dayCode;
  if (dayOfYear < 1 || dayOfYear > 366) return fail('DAY', n);

  //Convert day-of-year to month/day using the 29-day-February table
  let month = 0;
  let day = dayOfYear;
  while (day > MONTH_DAYS[month]) {
    day -= MONTH_DAYS[month];
    month += 1;
  }
  if (month === 1 && day === 29 && !isLeapYear(year)) return fail('DAY', n);

  const birth = new Date(Date.UTC(year, month, day));
  if (birth.getTime() > now.getTime()) return fail('FUTURE', n);

  let age = now.getUTCFullYear() - year;
  const hadBirthday =
    now.getUTCMonth() > month || (now.getUTCMonth() === month && now.getUTCDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < minAge) return fail('UNDERAGE', n);

  //Same person must map to the same value whichever format they type
  const nic12 = format === 'new' ? n : `${year}${pad(dayCode, 3)}0${serial}${check}`;

  return {
    valid: true,
    nic: n,
    nic12,
    format,
    gender: female ? 'female' : 'male',
    birthYear: year,
    birthDate: `${year}-${pad(month + 1, 2)}-${pad(day, 2)}`,
    age,
  };
}

function isValidNic(nic, options) {
  return validateNic(nic, options).valid;
}

/**
 12-digit form of a valid NIC (old numbers are converted), or null.
 Store/hash THIS value so 912345678V and 199123405678 cannot create
 two accounts for the same person.
 */
function canonicalNic(nic) {
  const r = validateNic(nic);
  return r.valid ? r.nic12 : null;
}

module.exports = { validateNic, isValidNic, canonicalNic, normalizeNic, MESSAGES };

//Self-tests (node nicValidator.js)
if (require.main === module) {
  const now = new Date(Date.UTC(2026, 9, 18)); // fixed date so tests are stable
  const cases = [
    //[input, expected valid, expected error/key detail]
    ['912345678V', true, '1991-08-21 male'],
    ['912345678v', true, 'lowercase letter accepted'],
    ['  912345678X ', true, 'spaces trimmed, X accepted'],
    ['917345678V', true, '1991-08-21 female'],
    ['199123405678', true, '1991-08-21 male (new format)'],
    ['200015000123', true, 'new format, day 150'],
    ['200050100123', true, 'new format, female, day 001'],
    ['', false, 'EMPTY'],
    ['12345', false, 'FORMAT'],
    ['91234567V', false, 'FORMAT (8 digits)'],
    ['9123456789', false, 'FORMAT (no letter, 10 digits)'],
    ['91234A678V', false, 'FORMAT (letter inside)'],
    ['910005678V', false, 'DAY (day 000)'],
    ['913675678V', false, 'DAY (day 367)'],
    ['915005678V', false, 'DAY (female day 000)'],
    ['199106012345', false, 'DAY (29 Feb 1991 does not exist)'],
    ['198806012345', true, '29 Feb 1988 (leap year) is fine'],
    ['203512300001', false, 'YEAR (born 2035)'],
    ['189912300001', false, 'YEAR (before 1900)'],
  ];

  let failed = 0;
  for (const [input, expected, note] of cases) {
    const r = validateNic(input, { now });
    const ok = r.valid === expected;
    if (!ok) failed += 1;
    const detail = r.valid ? `${r.birthDate} ${r.gender} -> ${r.nic12}` : r.error;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(input).padEnd(18)} ${detail.padEnd(36)} ${note}`);
  }

  //Old and new forms of the same person must give the same canonical value
  const same = canonicalNic('912345678V') === canonicalNic('199123405678');
  if (!same) failed += 1;
  console.log(`${same ? 'PASS' : 'FAIL'}  old/new format give the same canonical NIC`);

  //Minimum age (born 2010 is under 18 in Oct 2026)
  const young = validateNic('201015000123', { now, minAge: 18 });
  const youngOk = !young.valid && young.error === 'UNDERAGE';
  if (!youngOk) failed += 1;
  console.log(`${youngOk ? 'PASS' : 'FAIL'}  minAge 18 rejects someone born in 2010`);

  console.log(failed === 0 ? '\nAll tests passed' : `\n${failed} test(s) failed`);
  process.exitCode = failed === 0 ? 0 : 1;
}