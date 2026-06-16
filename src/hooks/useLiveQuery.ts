import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

export function useLiveQuery<T>(
  querier: () => Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const [result, setResult] = useState<T | undefined>();

  useEffect(() => {
    // Dexie liveQuery re-runs when any table touched by querier changes.
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (value) => setResult(value),
      error: (error) => console.error('Live query error:', error),
    });
    return () => subscription.unsubscribe();
    // Deps are supplied by each caller to match the query inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}
