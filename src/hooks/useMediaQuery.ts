import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query in React.
 *
 * Used to render *either* the desktop toolbar *or* the mobile action bar, rather
 * than rendering both and hiding one with CSS: duplicated markup would duplicate
 * every `data-testid` and every focusable control in the accessibility tree.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True at the phone/tablet-portrait breakpoint used by the workbench layout. */
export function useIsCompactLayout(): boolean {
  return useMediaQuery('(max-width: 860px)');
}
