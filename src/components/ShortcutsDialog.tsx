import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { SHORTCUTS } from './shortcuts';

export interface Shortcut {
  keys: string[];
  label: string;
  group: string;
}

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="键盘快捷键"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" data-testid="shortcuts-dialog">
        <div className="modal-head">
          <h2>键盘快捷键</h2>
          <button type="button" className="btn btn-icon" onClick={onClose} ref={closeRef} aria-label="关闭">
            <Icon name="check" size={16} />
          </button>
        </div>
        <div className="modal-body">
          {groups.map((group) => (
            <div key={group} style={{ marginTop: 12 }}>
              <h4 className="section-title">{group}</h4>
              {SHORTCUTS.filter((s) => s.group === group).map((shortcut) => (
                <div className="shortcut-row" key={shortcut.label}>
                  <span>{shortcut.label}</span>
                  <span className="shortcut-keys">
                    {shortcut.keys.map((key) => (
                      <kbd className="kbd" key={key}>
                        {key}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
