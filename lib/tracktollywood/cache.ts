import NodeCache from 'node-cache';

// Fresh-data cache -- short TTL (300s for the fast-changing hub pages, up
// to 1800s for the compiled/completed archive; see the per-call TTL each
// cachedFetch() call passes). checkperiod sweeps expired entries off the
// heap periodically instead of only on access.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// Stale-fallback cache -- holds the LAST successfully fetched value for
// every key TrackTollywood has ever answered, with no expiry (stdTTL: 0
// = never auto-evict). This is the safety net that keeps the site
// showing real numbers instead of "0"s (the homepage's own
// `.catch(() => [])` on a rejected fetch) or a raw "Request failed with
// status code 403" (the box-office page) whenever TrackTollywood starts
// rejecting requests from this app's production host -- confirmed
// 2026-09-24: the same request succeeded from two independent networks
// but was refused specifically from the deployed site, consistent with
// a WAF/IP-reputation block on the hosting provider's egress range
// rather than TrackTollywood being down. It's a separate store from the
// fresh cache above on purpose: the fresh cache's short TTL is what
// keeps ordinary data current, while this one only ever gets read when
// a fetch has actually failed and there's nothing fresher to serve.
const staleCache = new NodeCache({ stdTTL: 0 });

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
      staleCache.set(key, value);
      return value;
    })
    .catch((err) => {
      // A fresh fetch just failed. Fall back to the last value that DID
      // succeed for this exact key, if one exists, instead of letting
      // every page that reads live TrackTollywood data show an error or
      // a false "0" -- stale real numbers are more useful to a visitor
      // than that. A key that has never once succeeded (a brand new
      // key, or the very first request after a cold start while
      // TrackTollywood is already down) has nothing to fall back to and
      // still throws, exactly as before this change.
      const stale = staleCache.get<T>(key);
      if (stale !== undefined) {
        console.warn(`cachedFetch: "${key}" failed (${err?.message ?? err}) -- serving last-known-good data instead.`);
        return stale;
      }
      throw err;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function clearTrackTollywoodCache() {
  cache.flushAll();
  staleCache.flushAll();
  inFlight.clear();
}
