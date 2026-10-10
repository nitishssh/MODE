import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from './session';
import { message, SessionChangedError } from './session-client';
export function useResource<T>(path: string) {
  const { client } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const load = useCallback(() => {
    const current = ++sequence.current;
    return client.request<T>(path).then(value => {
      if (current === sequence.current) { setData(value); setTime(new Date()); }
    }).catch(err => { if (current === sequence.current && !(err instanceof SessionChangedError)) setError(message(err)); })
      .finally(() => { if (current === sequence.current) setLoading(false); });
  }, [client, path]);
  const reload = useCallback(() => { setLoading(true); setError(null); return load(); }, [load]);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  return { data, time, error, loading, reload };
}
