import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.VITE_POCKETBASE_ADMIN_EMAIL || 'finix8421@gmail.com';
const ADMIN_PASS = process.env.VITE_POCKETBASE_ADMIN_PASSWORD || '9822334020';

const pb = new PocketBase(PB_URL);

function normalizeDept(d) {
  return (d || '').trim().replace(/\s+/g, '_').toLowerCase();
}

async function main() {
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log('Authenticated as admin');

  const [deptEvents, overallEvents, records] = await Promise.all([
    pb.collection('activity_events').getFullList({
      filter: "action = 'department_status_changed'",
      sort: 'event_time',
      requestKey: null,
    }),
    pb.collection('activity_events').getFullList({
      filter: "action = 'overall_status_changed'",
      sort: 'event_time',
      requestKey: null,
    }),
    pb.collection('work_orders').getFullList({ requestKey: null }),
  ]);

  console.log(`Events: ${deptEvents.length} dept, ${overallEvents.length} overall`);
  console.log(`Work orders: ${records.length}`);

  // Build map: wo_id -> all overall_status_changed events sorted ascending
  const overallByWO = new Map();
  for (const ev of overallEvents) {
    const list = overallByWO.get(ev.work_order_id) || [];
    list.push(ev);
    overallByWO.set(ev.work_order_id, list);
  }

  // Build map: (wo_id|department) -> all department_status_changed events sorted ascending
  const deptByKey = new Map();
  for (const ev of deptEvents) {
    const key = `${ev.work_order_id}|${normalizeDept(ev.department)}`;
    const list = deptByKey.get(key) || [];
    list.push(ev);
    deptByKey.set(key, list);
  }



  let updated = 0;
  let skipped = 0;
  let cleared = 0;

  for (const record of records) {
    const deptStatuses = record.department_statuses;
    if (!Array.isArray(deptStatuses) || deptStatuses.length === 0) {
      skipped++;
      continue;
    }

    const woId = record.legacy_id || record.id;
    let changed = false;
    const next = deptStatuses.map(entry => {
      const deptNorm = normalizeDept(entry.department);
      const deptEventsList = deptByKey.get(`${woId}|${deptNorm}`) || [];
      const overallEventsList = overallByWO.get(woId) || [];

      let creatorName = null;
      let creatorTime = null;

      const firstDeptEv = deptEventsList[0];
      const firstOverallEv = overallEventsList[0];

      // Case 1: overall_status_changed happened before first department change
      if (firstOverallEv && firstDeptEv) {
        if (new Date(firstOverallEv.event_time) <= new Date(firstDeptEv.event_time)) {
          creatorName = firstOverallEv.actor_name;
          creatorTime = firstOverallEv.event_time;
        }
      }

      // Case 2: only overall_status_changed exists
      if (!creatorName && firstOverallEv && !firstDeptEv) {
        creatorName = firstOverallEv.actor_name;
        creatorTime = firstOverallEv.event_time;
      }

      // Case 3: overall_status_changed exists but came AFTER dept change,
      // OR only department_status_changed exists.
      // The creator was set at INSERT time by makeDepartmentStatuses,
      // but that original updated_by was overwritten by the first status change.
      if (!creatorName) {
        if (firstDeptEv) {
          const oldVal = firstDeptEv.old_value || '';
          const newVal = firstDeptEv.new_value || '';
          if (oldVal === 'Not Started' && newVal !== 'Not Started') {
            if (firstDeptEv.actor_name !== entry.updated_by && entry.created_by === entry.updated_by) {
              changed = true;
              cleared++;
              return { ...entry, created_by: '', created_at: '' };
            }
            if (firstDeptEv.actor_name === entry.updated_by && (entry.created_by === '' || entry.created_by == null || entry.created_by === 'undefined')) {
              changed = true;
              cleared++;
              return { ...entry, created_by: entry.updated_by, created_at: entry.updated_at };
            }
          }
          return entry;
        }
        // No events: restore from updated_by (set at insert by makeDepartmentStatuses)
        if (entry.created_by === '' || entry.created_by == null || entry.created_by === 'undefined') {
          changed = true;
          cleared++;
          return { ...entry, created_by: entry.updated_by, created_at: entry.updated_at };
        }
        return entry;
      }

      // Apply derived creator if different
      if (creatorName !== entry.created_by || creatorTime !== entry.created_at) {
        changed = true;
        cleared++;
      }
      return { ...entry, created_by: creatorName, created_at: creatorTime };
    });

    if (changed) {
      await pb.collection('work_orders').update(record.id, { department_statuses: next }, { requestKey: null });
      updated++;
    }
  }

  console.log(`Updated ${updated} work orders, skipped ${skipped} with no department_statuses`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
