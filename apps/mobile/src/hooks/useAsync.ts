import { useCallback, useEffect, useRef, useState } from 'react';

/** Petit hook de chargement avec rechargement manuel (pull-to-refresh). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fn();
      if (mounted.current) { setData(r); setError(undefined); }
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    void run();
    return () => { mounted.current = false; };
  }, [run]);

  return { data, error, loading, reload: run, setData };
}

/** Lance `fn` et lève les erreurs Postgrest au lieu de les renvoyer. */
export async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}
