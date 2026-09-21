import NodeCache from 'node-cache';

// One shared cache for every TrackTollywood response this app serves.
// stdTTL is in seconds -- 300 (5 min) sits at the fast end of the
// brief's requested 5-10 min window, since the site's own "Upd ..."
// timestamps on live movies change roughly every few minutes and a
// shorter TTL keeps this closer to that without hammering the site.
// checkperiod sweeps expired entries off the heap periodically instead
// of only on access.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// De-dupes concurrent requests for the same still-uncached key (e.g. two
// people opening the same movie page in the same second) so they share
// one upstream fetch instead of firing it twice -- node-cache alone only
// dedupes AFTER the first call has already resolved and been stored.
const inFlight = new Map<string, Promise<unknown>>();

export async function cachedFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((value) => {
      cache.set(key, value, ttlSeconds);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function clearTrackTollywoodCache() {
  cache.flushAll();
  inFlight.clear();
}
