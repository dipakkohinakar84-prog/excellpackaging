import PocketBase, { type RecordModel } from 'pocketbase';

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

const DEFAULT_POCKETBASE_URL = 'http://127.0.0.1:8090';

export const pocketBaseUrl =
  (import.meta.env.VITE_POCKETBASE_URL as string | undefined) || DEFAULT_POCKETBASE_URL;

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
]);

const normalizeRecord = <T = any>(record: RecordModel | Record<string, any>): T => {
  const normalized: Record<string, any> = { ...record };

  if (normalized.legacy_id !== undefined && normalized.legacy_id !== null) {
    normalized.id = normalized.legacy_id;
  }

  normalized.pb_id = record.id;
  return normalized as T;
};

const normalizePayload = (collection: string, payload: Record<string, any>) => {
  const normalized = { ...payload };

  if (idFieldCollections.has(collection) && normalized.id !== undefined && normalized.legacy_id === undefined) {
    normalized.legacy_id = normalized.id;
    delete normalized.id;
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
  return sorts.map((sort) => `${sort.ascending ? '' : '-'}${sort.field === 'id' ? 'legacy_id' : sort.field}`).join(',');
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

  insert(payload: Record<string, any>[]) {
    this.mutation = { type: 'insert', payload };
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

        const records = await collection.getFullList({ filter, sort, requestKey: null });
        const rows = (this.maxRows ? records.slice(0, this.maxRows) : records).map((record) => normalizeRecord(record));
        return { data: rows as T, error: null, count: rows.length };
      }

      if (mutation.type === 'insert') {
        const created = [];
        for (const row of mutation.payload) {
          const record = await collection.create(normalizePayload(this.collectionName, row), { requestKey: null });
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

  constructor(private readonly name: string) {
    void this.name;
  }

  on(_type: 'postgres_changes', config: { event: string; schema?: string; table: string }, callback: RealtimeHandler['callback']) {
    this.handlers.push({ event: config.event, table: config.table, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    const tables = Array.from(new Set(this.handlers.map((handler) => handler.table)));

    Promise.all(
      tables.map(async (table) => {
        const pocketBaseTable = resolveCollectionName(table);

        const unsubscribe = await pb.collection(pocketBaseTable).subscribe('*', (event) => {
          const matchingHandlers = this.handlers.filter((handler) => {
            const action = event.action.toUpperCase();
            return handler.table === table && (handler.event === '*' || handler.event.toUpperCase() === action);
          });

          const payload = {
            eventType: event.action.toUpperCase(),
            new: event.action === 'delete' ? null : normalizeRecord(event.record),
            old: event.action === 'delete' ? normalizeRecord(event.record) : null,
          };

          matchingHandlers.forEach((handler) => handler.callback(payload));
        });

        this.unsubscribeTasks.push(unsubscribe);
      }),
    )
      .then(() => callback?.('SUBSCRIBED'))
      .catch(() => callback?.('CHANNEL_ERROR'));

    return this;
  }

  unsubscribe() {
    this.unsubscribeTasks.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeTasks = [];
  }
}

export const supabase = {
  from: <T = any>(collection: string) => new PocketBaseQuery<T>(collection),
  channel: (name: string) => new PocketBaseChannel(name),
  removeChannel: (channel: PocketBaseChannel) => channel.unsubscribe(),
};
