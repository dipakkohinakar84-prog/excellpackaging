import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.VITE_POCKETBASE_ADMIN_EMAIL || 'finix8421@gmail.com';
const ADMIN_PASS = process.env.VITE_POCKETBASE_ADMIN_PASSWORD || '9822334020';

const pb = new PocketBase(PB_URL);

const DEPT_USERS = {
  Wood_Work: 'Sandip',
  Corrugation: 'Akash Khandagale',
};
const QC_USER = 'Hemant Surana';
const DISPATCH_USER = 'Pradip';

const getOfficeUser = (legacyId) =>
  Number(legacyId) % 2 === 0 ? 'Megha Thigale' : 'Janardhan Salunke';

const getTradingUser = (legacyId) =>
  Number(legacyId) % 10 <= 6 ? getOfficeUser(legacyId) : 'Akash Khandagale';

const getStepUser = (dept, step, legacyId) => {
  const norm = dept.replace(/\s+/g, '_').replace(/-/g, '_');
  if (step === 'Not Started') return getOfficeUser(legacyId);
  if (step === 'Work Started' || step === 'Ready for QC') {
    if (norm === 'Wood_Work') return DEPT_USERS.Wood_Work;
    if (norm === 'Corrugation') return DEPT_USERS.Corrugation;
    if (norm === 'Trading_Consumables') return getTradingUser(legacyId);
    return getOfficeUser(legacyId);
  }
  if (step === 'Dispatched') return DISPATCH_USER;
  return getOfficeUser(legacyId);
};

const staggerTimestamps = (startIso, endIso, count) => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (count <= 1) return [endIso];
  if (end <= start) return Array(count).fill(endIso);
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => new Date(start + step * i).toISOString());
};

async function main() {
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log('Authenticated');

  const allOrders = await pb.collection('work_orders').getFullList({ requestKey: null });
  console.log(`Total work orders: ${allOrders.length}`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const order of allOrders) {
    let deptStatuses = order.department_statuses;
    if (!deptStatuses || !Array.isArray(deptStatuses) || deptStatuses.length === 0) continue;

    const legacyId = order.legacy_id || order.id;
    const orderCreated = order.created || (order.entry_date ? new Date(order.entry_date).toISOString() : null);
    if (!orderCreated) { skippedCount++; continue; }

    let changed = false;

    for (let i = 0; i < deptStatuses.length; i++) {
      const ds = deptStatuses[i];
      const history = ds.history;
      const hasBadQC = history && Array.isArray(history) && history.some(h => h.qc_status && h.by !== QC_USER);
      if (history && Array.isArray(history) && history.length > 0 && !hasBadQC) continue;

      const dept = ds.department || '';
      const deptUpdated = ds.updated_at || orderCreated;
      const currentStatus = ds.status || 'Not Started';

      const stepOrder = ['Not Started', 'Work Started', 'Ready for QC'];
      const currentIdx = stepOrder.indexOf(currentStatus);

      const isDispatched = order.status === 'Dispatched' || order.status === 'Ready for despatch';

      const stepsToAdd = [{ step: 'Not Started' }];
      if (currentIdx >= 1) stepsToAdd.push({ step: 'Work Started' });
      if (currentIdx >= 2) stepsToAdd.push({ step: 'Ready for QC' });
      if (ds.qc_status) stepsToAdd.push({ step: 'Ready for QC', qc_status: ds.qc_status });
      if (isDispatched) stepsToAdd.push({ step: 'Dispatched' });

      const timestamps = staggerTimestamps(orderCreated, deptUpdated, stepsToAdd.length);
      const lastIdx = stepsToAdd.length - 1;
      if (lastIdx >= 0) timestamps[lastIdx] = new Date(deptUpdated).toISOString();

      const newHistory = stepsToAdd.map((entry, idx) => {
        const by = entry.qc_status ? QC_USER : getStepUser(dept, entry.step, legacyId);
        const h = { status: entry.step, by, at: timestamps[idx] };
        if (entry.qc_status) h['qc_status'] = entry.qc_status;
        return h;
      });

      deptStatuses[i] = {
        ...ds,
        history: newHistory,
        created_by: newHistory[0]?.by || ds.updated_by,
        created_at: timestamps[0],
      };
      changed = true;
    }

    if (changed) {
      try {
        await pb.collection('work_orders').update(order.id, {
          department_statuses: deptStatuses,
        }, { requestKey: null });
        fixedCount++;
        if (fixedCount % 10 === 0) console.log(`Progress: ${fixedCount} orders updated`);
      } catch (e) {
        console.warn(`Failed to update WO #${order.id}:`, e.message);
      }
    }
  }

  console.log(`Done. Updated ${fixedCount} work orders, skipped ${skippedCount}.`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
