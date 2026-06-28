import { useCallback, useEffect, useState } from 'react';

export interface SimulatedLoad {
  loading: boolean;
  error: boolean;
  reload: () => void;
}

/**
 * Simulates a short network fetch so screens show a realistic loading state on
 * mount. The MVP reads from in-memory mock stores, so by default this never
 * errors (`failOnce` is provided only to exercise the ErrorState component).
 *
 * When the real backend is wired (services/*), replace this with the actual
 * request lifecycle (loading → data | error → retry).
 */
export function useSimulatedLoad(ms = 450, failOnce = false): SimulatedLoad {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      if (!active) return;
      if (failOnce && attempt === 0) setError(true);
      setLoading(false);
    }, ms);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [attempt, ms, failOnce]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  return { loading, error, reload };
}
