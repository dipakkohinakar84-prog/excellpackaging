import PocketBase, { type RecordModel } from 'pocketbase';
import type { User } from './types';

type QueryResult<T = any> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

type SelectOptions = {
  count?: 'exact' | string;
  head?: boolean;
};

type Filter = {
  field: string;
  operator: 'eq' | 'in';
  value: any;
};

type Mutation =
  | { type: 'select'; columns?: string; options?: SelectOptions }
  | { type: 'insert'; payload: any[] }
  | { type: 'update'; payload: Record<string, any> }
  | { type: 'delete' }
  | { type: 'upsert'; payload: Record<string, any>; onConflict?: string };

type RealtimeHandler = {
  event: string;
  table: string;
  callback: (payload: { eventType: string; new: any; old: any }) => void;
};

const toPostgresEvent = (action: string) => {
  const normalized = action.toLowerCase();
  if (normalized === 'create') return 'INSERT';
  if (normalized === 'update') return 'UPDATE';
  if (normalized === 'delete') return 'DELETE';
  return action.toUpperCase();
};

const DEFAULT_POCKETBASE_URL = 'http://127.0.0.1:8090';
const REALTIME_POLL_INTERVAL_MS = 8000;

export const pocketBaseUrl =
  (import.meta.env.VITE_POCKETBASE_URL as string | undefined) || DEFAULT_POCKETBASE_URL;

const realtimeMode =
  (import.meta.env.VITE_REALTIME_MODE as string | undefined) || (import.meta.env.PROD ? 'polling' : 'pocketbase');

export const pb = new PocketBase(pocketBaseUrl);
pb.autoCancellation(false);

// Compatibility exports while the app is migrated away from Supabase names.
export const supabaseUrl = pocketBaseUrl;
export const supabaseAnonKey = '';

const collectionAliases: Record<string, string> = {
  users: 'erp_users',
};

const resolveCollectionName = (collection: string) => collectionAliases[collection] || collection;

const idFieldCollections = new Set([
  'users',
  'erp_users',
  'departments',
  'customers',
  'items',
  'work_orders',
  'dispatch_logs',
  'custom_bom_plans',
  'notification_events',
  'activity_events',
]);

const legacyIdStart: Record<string, number> = {
  users: 1,
  erp_users: 1,
  departments: 1,
  customers: 1,
  items: 1,
  work_orders: 1001,
  dispatch_logs: 1,
  custom_bom_plans: 1,
  notification_events: 1,
  activity_events: 1,
};

const isValidLegacyId = (value: any) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const normalizeRecord = <T = any>(record: RecordModel | Record<string, any>): T => {
  const normalized: Record<string, any> = { ...record };

  if (normalized.display_name) {
    normalized.auth_username = normalized.username;
    normalized.username = normalized.display_name;
  }

  if (isValidLegacyId(normalized.legacy_id)) {
    normalized.id = normalized.legacy_id;
  }

  if (normalized.created !== undefined && normalized.created_at === undefined) {
    normalized.created_at = normalized.created;
  }

  if (normalized.updated !== undefined && normalized.updated_at === undefined) {
    normalized.updated_at = normalized.updated;
  }

  if (normalized.drawing_file && !normalized.drawing_image_url) {
    const fileName = Array.isArray(normalized.drawing_file) ? normalized.drawing_file[0] : normalized.drawing_file;
    if (fileName) normalized.drawing_image_url = pb.files.getURL(record as RecordModel, fileName);
  }

  normalized.pb_id = record.id;
  return normalized as T;
};

const normalizeMobileIdentity = (mobile: string) => mobile.replace(/\D/g, '').slice(-10);

const FEATURE_FLAG_FIELDS: (keyof User)[] = [
  'can_access_dashboard', 'can_access_work_orders', 'can_access_customers',
  'can_access_items', 'can_access_production_plan', 'can_access_reports',
  'can_access_daily_tasks', 'can_access_departments', 'can_access_users',
  'can_access_client_orders', 'can_access_live_screen', 'can_access_dispatch',
  'can_access_notifications', 'can_access_components', 'can_access_custom_bom',
  'can_access_production_entry',
];

export const mapAuthRecordToUser = (record: RecordModel | Record<string, any> | null | undefined): User | null => {
  if (!record) return null;
  const normalized = normalizeRecord<User>(record);
  const user: User = {
    id: Number(normalized.id || (normalized as any).legacy_id || 0),
    username: String((record as any).display_name || normalized.username || ''),
    email: String(normalized.email || ''),
    mobile: String(normalized.mobile || (record as any).username || ''),
    vehicle_number: normalized.vehicle_number || '',
    department: String(normalized.department || ''),
    level: String(normalized.level || ''),
  };
  for (const field of FEATURE_FLAG_FIELDS) {
    const val = (normalized as any)[field];
    if (val !== undefined) {
      (user as any)[field] = val === true;
    }
  }
  return user;
};

export const loginWithMobilePassword = async (mobile: string, password: string) => {
  const identity = normalizeMobileIdentity(mobile);
  if (!identity) throw new Error('Enter a valid registered mobile number.');

  const userRecord = await pb.collection('erp_users').getFirstListItem(
    `mobile = ${escapeFilterValue(identity)}`,
    { requestKey: null },
  ).catch(() => null);

  if (!userRecord) throw new Error('Invalid mobile number or passkey.');

  const authIdentity = String(userRecord.login_email || userRecord.email || userRecord.username || identity);
  const authData = await pb.collection('erp_users').authWithPassword(authIdentity, password);
  const user = mapAuthRecordToUser(authData.record);
  if (!user) throw new Error('Authenticated user profile is missing.');
  return user;
};

export const getCurrentAuthUser = () => mapAuthRecordToUser(pb.authStore.record);

export const logoutAuth = () => {
  pb.authStore.clear();
};

const normalizePayload = (collection: string, payload: Record<string, any>) => {
  const normalized = { ...payload };

  if (idFieldCollections.has(collection) && normalized.id !== undefined && normalized.legacy_id === undefined) {
    normalized.legacy_id = normalized.id;
    delete normalized.id;
  }

  return normalized;
};

const getNextLegacyId = async (collectionName: string) => {
  const records = await pb.collection(resolveCollectionName(collectionName)).getFullList({
    fields: 'legacy_id',
    requestKey: null,
  });

  const highest = records.reduce((max, record) => {
    const value = Number(record.legacy_id || 0);
    return value > max ? value : max;
  }, 0);

  return highest > 0 ? highest + 1 : (legacyIdStart[collectionName] || 1);
};

const ensureLegacyId = async (collectionName: string, payload: Record<string, any>) => {
  const normalized = normalizePayload(collectionName, payload);

  if (
    idFieldCollections.has(collectionName) &&
    !isValidLegacyId(normalized.legacy_id)
  ) {
    normalized.legacy_id = await getNextLegacyId(collectionName);
  }

  return normalized;
};

const escapeFilterValue = (value: any): string => {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';
  return JSON.stringify(String(value));
};

const toPocketBaseField = (collection: string, field: string) => {
  if (field === 'id' && idFieldCollections.has(collection)) return 'legacy_id';
  if (field === 'created_at' && idFieldCollections.has(collection)) return 'legacy_id';
  if (field === 'updated_at' && idFieldCollections.has(collection)) return 'legacy_id';
  if (field === 'created_at') return 'id';
  if (field === 'updated_at') return 'id';
  return field;
};

const buildFilter = (collection: string, filters: Filter[]) => {
  if (filters.length === 0) return undefined;

  return filters
    .map((filter) => {
      const field = toPocketBaseField(collection, filter.field);

      if (filter.operator === 'in') {
        const values = Array.isArray(filter.value) ? filter.value : [];
        if (values.length === 0) return 'id = "__never__"';
        return values.map((value) => `${field} = ${escapeFilterValue(value)}`).join(' || ');
      }

      return `${field} = ${escapeFilterValue(filter.value)}`;
    })
    .map((part) => `(${part})`)
    .join(' && ');
};

const toPocketBaseSort = (sorts: { field: string; ascending: boolean }[]) => {
  if (sorts.length === 0) return undefined;
  return sorts.map((sort) => `${sort.ascending ? '' : '-'}${toPocketBaseField('', sort.field)}`).join(',');
};

const toError = (error: any) => ({
  message: error?.message || 'PocketBase request failed',
  code: error?.status === 404 ? 'PGRST116' : String(error?.status || error?.code || ''),
});

class PocketBaseQuery<T = any> implements PromiseLike<QueryResult<T>> {
  private mutation: Mutation | null = null;
  private filters: Filter[] = [];
  private sorts: { field: string; ascending: boolean }[] = [];
  private maxRows?: number;
  private offset = 0;
  private wantsSingle = false;
  private readonly pocketBaseCollectionName: string;

  constructor(private readonly collectionName: string) {
    this.pocketBaseCollectionName = resolveCollectionName(collectionName);
  }

  select(columns = '*', options?: SelectOptions) {
    if (this.mutation && this.mutation.type !== 'select') return this;
    this.mutation = { type: 'select', columns, options };
    return this;
  }

  insert(payload: Record<string, any>[] | Record<string, any>) {
    this.mutation = { type: 'insert', payload: Array.isArray(payload) ? payload : [payload] };
    return this;
  }

  update(payload: Record<string, any>) {
    this.mutation = { type: 'update', payload };
    return this;
  }

  delete() {
    this.mutation = { type: 'delete' };
    return this;
  }

  upsert(payload: Record<string, any>, options?: { onConflict?: string }) {
    this.mutation = { type: 'upsert', payload, onConflict: options?.onConflict };
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  in(field: string, value: any[]) {
    this.filters.push({ field, operator: 'in', value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sorts.push({ field, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  range(start: number, end: number) {
    this.offset = start;
    this.maxRows = end - start + 1;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      const mutation = this.mutation || { type: 'select', columns: '*' };
      const collection = pb.collection(this.pocketBaseCollectionName);
      const filter = buildFilter(this.collectionName, this.filters);
      const sort = toPocketBaseSort(this.sorts);

      if (mutation.type === 'select') {
        if (mutation.options?.head) {
          const result = await collection.getList(1, 1, { filter, sort, requestKey: null });
          return { data: null, error: null, count: result.totalItems };
        }

        if (this.wantsSingle) {
          const record = await collection.getFirstListItem(filter || '', { sort, requestKey: null });
          return { data: normalizeRecord(record) as T, error: null, count: 1 };
        }

        if (this.maxRows) {
          const page = this.offset > 0 ? Math.floor(this.offset / this.maxRows) + 1 : 1;
          const result = await collection.getList(page, this.maxRows, { filter, sort, requestKey: null });
          const rows = result.items.map((record) => normalizeRecord(record));
          return { data: rows as T, error: null, count: result.totalItems };
        }

        const records = await collection.getFullList({ filter, sort, requestKey: null });
        const rows = records.map((record) => normalizeRecord(record));
        return { data: rows as T, error: null, count: rows.length };
      }

      if (mutation.type === 'insert') {
        const created = [];
        for (const row of mutation.payload) {
          const record = await collection.create(await ensureLegacyId(this.collectionName, row), { requestKey: null });
          created.push(normalizeRecord(record));
        }

        const data = this.wantsSingle ? created[0] : created;
        return { data: data as T, error: null, count: created.length };
      }

      if (mutation.type === 'update') {
        const records = await collection.getFullList({ filter, requestKey: null });
        const updated = [];
        for (const record of records) {
          const next = await collection.update(record.id, normalizePayload(this.collectionName, mutation.payload), { requestKey: null });
          updated.push(normalizeRecord(next));
        }
        return { data: (this.wantsSingle ? updated[0] : updated) as T, error: null, count: updated.length };
      }

      if (mutation.type === 'delete') {
        const records = await collection.getFullList({ filter, requestKey: null });
        for (const record of records) {
          await collection.delete(record.id, { requestKey: null });
        }
        return { data: null, error: null, count: records.length };
      }

      if (mutation.type === 'upsert') {
        const conflict = mutation.onConflict;
        let existing: RecordModel | null = null;

        if (conflict && mutation.payload[conflict] !== undefined) {
          const conflictFilter = `${conflict} = ${escapeFilterValue(mutation.payload[conflict])}`;
          existing = await collection.getFirstListItem(conflictFilter, { requestKey: null }).catch(() => null);
        }

        const record = existing
          ? await collection.update(existing.id, normalizePayload(this.collectionName, mutation.payload), { requestKey: null })
          : await collection.create(normalizePayload(this.collectionName, mutation.payload), { requestKey: null });

        return { data: normalizeRecord(record) as T, error: null, count: 1 };
      }

      return { data: null, error: null, count: 0 };
    } catch (error: any) {
      return { data: null, error: toError(error), count: null };
    }
  }
}

class PocketBaseChannel {
  private handlers: RealtimeHandler[] = [];
  private unsubscribeTasks: Array<() => void> = [];
  private recordCache = new Map<string, any>();
  private pollTimer: ReturnType<typeof window.setInterval> | null = null;

  constructor(private readonly name: string) {
    void this.name;
  }

  on(_type: 'postgres_changes', config: { event: string; schema?: string; table: string }, callback: RealtimeHandler['callback']) {
    this.handlers.push({ event: config.event, table: config.table, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    const tables = Array.from(new Set(this.handlers.map((handler) => handler.table)));

    if (realtimeMode === 'polling') {
      this.subscribeWithPolling(tables, callback);
      return this;
    }

    Promise.all(
      tables.map(async (table) => {
        const pocketBaseTable = resolveCollectionName(table);

        const initialRecords = await pb.collection(pocketBaseTable).getFullList({ requestKey: null }).catch(() => []);
        initialRecords.forEach((record) => {
          const normalized = normalizeRecord(record);
          this.recordCache.set(`${table}:${record.id}`, normalized);
        });

        const unsubscribe = await pb.collection(pocketBaseTable).subscribe('*', (event) => {
          const action = toPostgresEvent(event.action);
          const cacheKey = `${table}:${event.record.id}`;
          const oldRecord = this.recordCache.get(cacheKey) || null;
          const newRecord = event.action === 'delete' ? null : normalizeRecord(event.record);

          if (newRecord) {
            this.recordCache.set(cacheKey, newRecord);
          } else {
            this.recordCache.delete(cacheKey);
          }

          const matchingHandlers = this.handlers.filter((handler) => {
            return handler.table === table && (handler.event === '*' || handler.event.toUpperCase() === action);
          });

          if (import.meta.env.DEV && matchingHandlers.length === 0) {
            console.debug('PocketBase realtime event had no matching handler:', { table, action, rawAction: event.action });
          }

          const payload = {
            eventType: action,
            new: newRecord,
            old: action === 'INSERT' ? null : oldRecord,
          };

          matchingHandlers.forEach((handler) => handler.callback(payload));
        });

        this.unsubscribeTasks.push(unsubscribe);
      }),
    )
      .then(() => {
        if (import.meta.env.DEV) console.debug('PocketBase realtime subscribed:', tables);
        callback?.('SUBSCRIBED');
      })
      .catch((error) => {
        console.error('PocketBase realtime subscription failed:', error);
        callback?.('CHANNEL_ERROR');
      });

    return this;
  }

  private async primeCache(tables: string[]) {
    await Promise.all(tables.map(async (table) => {
      const pocketBaseTable = resolveCollectionName(table);
      const initialRecords = await pb.collection(pocketBaseTable).getFullList({ requestKey: null }).catch(() => []);
      initialRecords.forEach((record) => {
        this.recordCache.set(`${table}:${record.id}`, normalizeRecord(record));
      });
    }));
  }

  private notifyHandlers(table: string, action: string, oldRecord: any, newRecord: any) {
    const matchingHandlers = this.handlers.filter((handler) => {
      return handler.table === table && (handler.event === '*' || handler.event.toUpperCase() === action);
    });

    const payload = {
      eventType: action,
      new: newRecord,
      old: action === 'INSERT' ? null : oldRecord,
    };

    matchingHandlers.forEach((handler) => handler.callback(payload));
  }

  private async pollTables(tables: string[]) {
    await Promise.all(tables.map(async (table) => {
      const pocketBaseTable = resolveCollectionName(table);
      const records = await pb.collection(pocketBaseTable).getFullList({ requestKey: null }).catch(() => []);
      const seenKeys = new Set<string>();

      records.forEach((record) => {
        const cacheKey = `${table}:${record.id}`;
        const newRecord = normalizeRecord(record);
        const oldRecord = this.recordCache.get(cacheKey) || null;
        seenKeys.add(cacheKey);

        if (!oldRecord) {
          this.recordCache.set(cacheKey, newRecord);
          this.notifyHandlers(table, 'INSERT', null, newRecord);
          return;
        }

        if (JSON.stringify(oldRecord) !== JSON.stringify(newRecord)) {
          this.recordCache.set(cacheKey, newRecord);
          this.notifyHandlers(table, 'UPDATE', oldRecord, newRecord);
        }
      });

      Array.from(this.recordCache.keys())
        .filter((cacheKey) => cacheKey.startsWith(`${table}:`) && !seenKeys.has(cacheKey))
        .forEach((cacheKey) => {
          const oldRecord = this.recordCache.get(cacheKey) || null;
          this.recordCache.delete(cacheKey);
          this.notifyHandlers(table, 'DELETE', oldRecord, null);
        });
    }));
  }

  private subscribeWithPolling(tables: string[], callback?: (status: string) => void) {
    this.primeCache(tables)
      .then(() => {
        if (import.meta.env.DEV) console.debug('PocketBase polling realtime active:', tables);
        callback?.('SUBSCRIBED');
        this.pollTimer = window.setInterval(() => {
          this.pollTables(tables).catch((error) => {
            console.error('PocketBase polling realtime failed:', error);
          });
        }, REALTIME_POLL_INTERVAL_MS);
      })
      .catch((error) => {
        console.error('PocketBase polling realtime setup failed:', error);
        callback?.('CHANNEL_ERROR');
      });
  }

  unsubscribe() {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.unsubscribeTasks.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeTasks = [];
  }
}

export const supabase = {
  from: <T = any>(collection: string) => new PocketBaseQuery<T>(collection),
  channel: (name: string) => new PocketBaseChannel(name),
  removeChannel: (channel: PocketBaseChannel) => channel.unsubscribe(),
};
