const db = require('../config/db');

async function seedIssues() {
  const conn = await db.getConnection();
  try {
    console.log('Seeding issues, votes, resolution proofs, and audit logs...');

    // 1. Get citizens and officers
    const [citizens] = await conn.query('SELECT CITIZEN_ID, FULL_NAME, MOBILE_NUMBER, NIC_HASH, WARD_ID FROM CITIZEN');
    const [officers] = await conn.query('SELECT OFFICER_ID, EMPLOYEE_ID, FULL_NAME, WARD_ID FROM OFFICER');
    const [wards] = await conn.query('SELECT WARD_ID, WARD_NAME FROM WARD WHERE WARD_ID IN (1, 2) ORDER BY WARD_ID');

    if (!citizens.length || !officers.length || !wards.length) {
      throw new Error('Please run seedCouncils, seedWards, seedCitizens, and seedOfficers first.');
    }

    const citizen1 = citizens[0];
    const citizen2 = citizens[1] || citizens[0];
    const officer1 = officers.find((o) => o.EMPLOYEE_ID === 'EMP-002') || officers[0];
    const ward1Id = wards[0].WARD_ID; // Ward 1 (Wathurugama)

    // Clear existing issues and dependent tables
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE REPORT_VERIFICATION');
    await conn.query('TRUNCATE TABLE RESOLUTION_PROOF');
    await conn.query('TRUNCATE TABLE EMERGENCY_ALERT');
    await conn.query('TRUNCATE TABLE VOTE');
    await conn.query('TRUNCATE TABLE COMMENT');
    await conn.query('TRUNCATE TABLE AUDIT_LOG');
    await conn.query('TRUNCATE TABLE ISSUE');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Define rich realistic issues for Ward 1
    const issuesData = [
      {
        citizen_id: citizen1.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Exposed Live Power Cable near Ward 04 Nursery',
        description: 'High voltage overhead cable collapsed following wind gusts. Currently sparking near nursery entrance. Immediate emergency barricading required.',
        category: 'Other',
        status: 'Open',
        is_emergency: 1,
        priority_score: 95,
        before_photo: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=600&auto=format&fit=crop&q=80',
        votes: 89,
        created_minutes_ago: 25,
      },
      {
        citizen_id: citizen2.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Damaged Streetlight Pole',
        description: 'The light pole bracket was bent following high winds last night. Electrical wiring is partially exposed and sparks during intermittent drizzle. Creates risk for pedestrians using the sidewalk.',
        category: 'Street Lighting',
        status: 'In Progress',
        is_emergency: 0,
        priority_score: 70,
        before_photo: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&auto=format&fit=crop&q=80',
        votes: 42,
        created_minutes_ago: 2880, // 2 days ago
      },
      {
        citizen_id: citizen1.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Illegal Commercial Waste Dumping at Corner Junction',
        description: 'Unregulated commercial dumping site causing foul odor, stray animal gathering, and drain blockage.',
        category: 'Waste Management',
        status: 'Open',
        is_emergency: 0,
        priority_score: 55,
        before_photo: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=600&auto=format&fit=crop&q=80',
        votes: 19,
        created_minutes_ago: 4320, // 3 days ago
      },
      {
        citizen_id: citizen2.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Deep Pothole Asphalt Patching near Bus Stand',
        description: 'Large crater near bus bay filled and leveled with bituminous hot-mix. Resolution photo submitted to council dashboard.',
        category: 'Road Hazard',
        status: 'Resolved',
        is_emergency: 0,
        priority_score: 60,
        before_photo: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
        after_photo: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
        proof_remarks: 'Asphalt cold patch applied and steam-rolled. Surface leveled to bus bay concrete edge.',
        votes: 31,
        created_minutes_ago: 5760, // 4 days ago
      },
      {
        citizen_id: citizen1.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Blocked Stormwater Culvert Causing Road Flooding',
        description: 'Plastic debris and silt buildup choking culvert throat. Causes severe puddle accumulation across road after rain.',
        category: 'Water Drainage',
        status: 'Open',
        is_emergency: 0,
        priority_score: 58,
        before_photo: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600&auto=format&fit=crop&q=80',
        votes: 27,
        created_minutes_ago: 1440, // 1 day ago
      },
      {
        citizen_id: citizen2.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Displaced Sidewalk Concrete Slab & Trip Hazard',
        description: 'Pavement slab fractured with 3-inch vertical edge. High risk of pedestrian falls near clinic entrance.',
        category: 'Road Hazard',
        status: 'Open',
        is_emergency: 0,
        priority_score: 45,
        before_photo: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop&q=80',
        votes: 24,
        created_minutes_ago: 2880,
      },
      {
        citizen_id: citizen1.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Leaking Main Water Pipeline on Footpath',
        description: 'Underground supply line ruptured. Continuous clear water seepage eroding road gravel foundation.',
        category: 'Water Drainage',
        status: 'In Progress',
        is_emergency: 0,
        priority_score: 65,
        before_photo: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
        votes: 35,
        created_minutes_ago: 4320,
      },
      {
        citizen_id: citizen2.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Broken Heavy Tree Branch on Electrical Line',
        description: 'Bough broken off ancient bo-tree resting against secondary electrical wires. Needs municipal tree pruning crew.',
        category: 'Other',
        status: 'Open',
        is_emergency: 0,
        priority_score: 40,
        before_photo: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=80',
        votes: 21,
        created_minutes_ago: 5760,
      },
      {
        citizen_id: citizen1.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Overflowing Municipal Bins at Central Bazaar',
        description: 'Three 240L municipal garbage receptacles overflowing. Odor spreading to nearby food stalls.',
        category: 'Waste Management',
        status: 'Open',
        is_emergency: 0,
        priority_score: 50,
        before_photo: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80',
        votes: 22,
        created_minutes_ago: 6000,
      },
      {
        citizen_id: citizen2.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Flickering High-Pressure Sodium Streetlamp',
        description: 'Streetlamp cycles on and off every 30 seconds. Creates safety concerns at dark pedestrian crossway.',
        category: 'Street Lighting',
        status: 'Open',
        is_emergency: 0,
        priority_score: 35,
        before_photo: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
        votes: 15,
        created_minutes_ago: 7200,
      },
      {
        citizen_id: citizen1.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Open Storm Drain Grating Missing Near School',
        description: 'Cast iron road grating missing. 1.2m drop right in path of walking schoolchildren.',
        category: 'Road Hazard',
        status: 'Open',
        is_emergency: 1,
        priority_score: 92,
        before_photo: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
        votes: 58,
        created_minutes_ago: 360,
      },
      {
        citizen_id: citizen2.CITIZEN_ID,
        ward_id: ward1Id,
        title: 'Unregulated Construction Debris on Public Berm',
        description: 'Piles of crushed brick, concrete chunks, and plaster bags dumped on council sidewalk.',
        category: 'Waste Management',
        status: 'Open',
        is_emergency: 0,
        priority_score: 30,
        before_photo: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop&q=80',
        votes: 14,
        created_minutes_ago: 8640,
      },
    ];

    for (const item of issuesData) {
      // Insert issue
      const [issueRes] = await conn.query(
        `INSERT INTO ISSUE (CITIZEN_ID, WARD_ID, OFFICER_ID, TITLE, DESCRIPTION, CATEGORY, STATUS, IS_EMERGENCY, PRIORITY_SCORE, BEFORE_PHOTO, CREATED_AT)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? MINUTE)`,
        [
          item.citizen_id,
          item.ward_id,
          officer1.OFFICER_ID,
          item.title,
          item.description,
          item.category,
          item.status,
          item.is_emergency,
          item.priority_score,
          item.before_photo,
          item.created_minutes_ago,
        ]
      );

      const issueId = issueRes.insertId;

      // Emergency Alert if emergency
      if (item.is_emergency) {
        await conn.query(
          `INSERT INTO EMERGENCY_ALERT (ISSUE_ID, OFFICER_ID, MESSAGE, OUTCOME)
           VALUES (?, ?, ?, 'Pending')`,
          [issueId, officer1.OFFICER_ID, `PRIORITY EMERGENCY: ${item.title}`.slice(0, 255)]
        );
      }

      // Votes
      if (item.votes > 0) {
        await conn.query(
          `INSERT INTO VOTE (ISSUE_ID, CITIZEN_ID, VOTE_TYPE)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE VOTE_TYPE = 1`,
          [issueId, item.citizen_id]
        );
      }

      // Resolution proof if Resolved
      if (item.status === 'Resolved' && item.after_photo) {
        const [proofRes] = await conn.query(
          `INSERT INTO RESOLUTION_PROOF (ISSUE_ID, OFFICER_ID, AFTER_PHOTO, REMARKS)
           VALUES (?, ?, ?, ?)`,
          [issueId, officer1.OFFICER_ID, item.after_photo, item.proof_remarks || 'Work completed.']
        );

        await conn.query(
          `INSERT INTO REPORT_VERIFICATION (ISSUE_ID, PROOF_ID, REPORTER_ID, RESPONSE, DEADLINE_AT)
           VALUES (?, ?, ?, 'Pending', NOW() + INTERVAL 14 DAY)`,
          [issueId, proofRes.insertId, item.citizen_id]
        );
      }

      // Audit Log for Issue Created
      await conn.query(
        `INSERT INTO AUDIT_LOG (ENTITY_TYPE, ENTITY_ID, ACTION, PERFORMED_BY_TYPE, PERFORMED_BY_ID, DETAILS, CREATED_AT)
         VALUES ('ISSUE', ?, 'ISSUE_CREATED', 'CITIZEN', ?, ?, NOW() - INTERVAL ? MINUTE)`,
        [
          issueId,
          item.citizen_id,
          JSON.stringify({ title: item.title, category: item.category, ward_id: item.ward_id }),
          item.created_minutes_ago,
        ]
      );

      // Audit Log for In Progress / Resolved
      if (item.status === 'In Progress' || item.status === 'Resolved') {
        await conn.query(
          `INSERT INTO AUDIT_LOG (ENTITY_TYPE, ENTITY_ID, ACTION, PERFORMED_BY_TYPE, PERFORMED_BY_ID, OLD_STATE, NEW_STATE, CREATED_AT)
           VALUES ('ISSUE', ?, 'STATUS_CHANGED', 'OFFICER', ?, ?, ?, NOW() - INTERVAL ? MINUTE)`,
          [
            issueId,
            officer1.OFFICER_ID,
            JSON.stringify({ status: 'Open' }),
            JSON.stringify({ status: 'In Progress' }),
            Math.max(10, Math.floor(item.created_minutes_ago / 2)),
          ]
        );
      }

      if (item.status === 'Resolved') {
        await conn.query(
          `INSERT INTO AUDIT_LOG (ENTITY_TYPE, ENTITY_ID, ACTION, PERFORMED_BY_TYPE, PERFORMED_BY_ID, DETAILS, CREATED_AT)
           VALUES ('RESOLUTION_PROOF', ?, 'PROOF_SUBMITTED', 'OFFICER', ?, ?, NOW() - INTERVAL 60 MINUTE)`,
          [
            issueId,
            officer1.OFFICER_ID,
            JSON.stringify({ remarks: item.proof_remarks }),
          ]
        );
      }
    }

    console.log(`Successfully seeded ${issuesData.length} issues into MySQL!`);
  } catch (err) {
    console.error('Issue seeding failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = seedIssues;

if (require.main === module) {
  seedIssues()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
