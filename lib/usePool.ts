'use client';

import { useEffect, useState } from 'react';
import { getPool, type PoolResponse } from './clientApi';

// Module-level stale-while-revalidate cache. Because the module stays
// loaded across client-side navigations, every page can render instantly
// from the last good payload instead of flashing a loading state.
let cache: PoolResponse | null = null;
let inflight: Promise<PoolResponse> | null = null;

export function getCachedPool(): PoolResponse | null {
  return cache;
}

export function invalidatePoolCache() {
  cache = null;
  inflight = null;
}

export function usePool() {
  const [pool, setPool] = useState<PoolResponse | null>(cache);
  const [err, setErr] = useState('');

  useEffect(() => {
    let active = true;
    const request = inflight ?? (inflight = getPool());
    request
      .then((res) => {
        inflight = null;
        if (res.ok) {
          cache = res;
          if (active) setPool(res);
        } else if (active) {
          setErr(res.error || 'Failed to load');
        }
      })
      .catch((e) => {
        inflight = null;
        if (active) setErr(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onFocus = () => {
      refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function refresh() {
    const res = await getPool();
    if (res.ok) {
      cache = res;
      setPool(res);
    }
    return res;
  }

  return { pool, err, refresh, setPool };
}
