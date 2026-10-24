import { useCallback, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
}

/** Lightweight toast queue used for copy/download feedback. */
export function useToasts(timeout = 2200) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const push = useCallback(
    (message: string, kind: Toast['kind'] = 'success') => {
      counterRef.current += 1;
      const id = counterRef.current;
      setToasts((current) => [...current, { id, message, kind }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, timeout);
    },
    [timeout],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
