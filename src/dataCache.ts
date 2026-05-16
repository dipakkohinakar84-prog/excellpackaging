type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

const loadAndStore = async <T>(key: string, loader: () => Promise<T>, ttlMs: number): Promise<T> => {
  const existingRequest = inFlight.get(key);
  if (existingRequest) return existingRequest as Promise<T>;

  const request = loader()
    .then(value => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
};

export const getCachedData = async <T>(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> => {
  const now = Date.now();
  const existing = cache.get(key);

  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  if (existing) {
    void loadAndStore(key, loader, ttlMs).catch(() => undefined);
    return existing.value as T;
  }

  return loadAndStore(key, loader, ttlMs);
};

export const setCachedData = <T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

export const primeCachedData = <T>(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS) => {
  void loadAndStore(key, loader, ttlMs).catch(() => undefined);
};

export const invalidateCachedData = (keyPrefix?: string) => {
  if (!keyPrefix) {
    cache.clear();
    inFlight.clear();
    return;
  }

  Array.from(cache.keys())
    .filter(key => key === keyPrefix || key.startsWith(`${keyPrefix}:`))
    .forEach(key => cache.delete(key));
  Array.from(inFlight.keys())
    .filter(key => key === keyPrefix || key.startsWith(`${keyPrefix}:`))
    .forEach(key => inFlight.delete(key));
};
