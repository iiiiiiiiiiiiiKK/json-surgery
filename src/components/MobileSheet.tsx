import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface SheetActionProps {
  icon: IconName;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  testId: string;
}

/** One full-width, 48px-tall row inside the sheet. */
export function SheetAction({ icon, label, hint, onClick, disabled, danger, testId }: SheetActionProps) {
  return (
    <button
      type="button"
      className={`sheet-action${danger ? ' danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      <span className="sheet-action-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="sheet-action-text">
        <span className="sheet-action-label">{label}</span>
        {hint ? <span className="sheet-action-hint">{hint}</span> : null}
      </span>
    </button>
  );
}

export interface MobileSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet used by the compact (phone) header for secondary actions.
 *
 * Deliberately not a modal dialog floating mid-screen: on a phone the thumb
 * reach zone is the bottom third, so the sheet slides up from there. Escape and
 * a backdrop tap close it, focus moves into the sheet on open and returns to the
 * trigger on close, and the page behind it does not scroll.
 */
export function MobileSheet({ open, title, onClose, children }: MobileSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('button, select, a[href]');
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      // Keep focus inside the sheet while it is open.
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), select, a[href]'),
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      } else if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="mobile-sheet-backdrop"
    >
      <div
        className="sheet"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="mobile-sheet"
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            aria-label="关闭"
            data-testid="mobile-sheet-close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
