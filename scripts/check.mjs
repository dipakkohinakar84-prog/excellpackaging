import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('finix8421@gmail.com', '9822334020');
for (const id of [1104, 1213, 1221]) {
  const r = (await pb.collection('work_orders').getFullList({ filter: 'legacy_id=' + id, requestKey: null }))[0];
  if (!r) { console.log('ORDER-#' + id + ': NOT FOUND'); continue; }
  console.log('ORDER-#' + id + ':');
  for (const ds of r.department_statuses) {
    console.log('  ' + ds.department + ': created_by="' + ds.created_by + '", updated_by="' + ds.updated_by + '"');
  }
}
