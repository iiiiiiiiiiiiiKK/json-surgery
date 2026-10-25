import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { samplesByCategory, type SampleData } from '../lib/samples';

export interface SampleLibraryProps {
  open: boolean;
  onClose: () => void;
  onPick: (sample: SampleData) => void;
}

/**
 * Sample library.
 *
 * A single "示例" button would have to cycle through the list, which is bad UX
 * once there is more than a handful. This overlay shows every sample grouped by
 * category, with the shape of the document spelled out, so the picker itself
 * teaches what the sample is for.
 *
 * Presentation is one component with two skins: a centred dialog on desktop and
 * a bottom sheet on phones (see `.picker` / `.picker-panel` in styles.css).
 */
export function SampleLibrary({ open, onClose, onPick }: SampleLibraryProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const timer = window.setTimeout(() => searchRef.current?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const groups = samplesByCategory()
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (sample) =>
          !needle ||
          sample.name.toLowerCase().includes(needle) ||
          sample.description.toLowerCase().includes(needle) ||
          sample.id.includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div
      className="picker-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="sample-library-backdrop"
    >
      <div
        className="picker-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="示例数据"
        data-testid="sample-library"
      >
        <div className="picker-head">
          <h2>示例数据</h2>
          <span className="picker-count">{groups.reduce((sum, g) => sum + g.items.length, 0)} 个</span>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            aria-label="关闭"
            data-testid="sample-library-close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="picker-search">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索示例（名称 / 用途 / id）"
            aria-label="搜索示例"
            data-testid="sample-search"
            spellCheck={false}
          />
        </div>

        <div className="picker-body">
          {groups.length === 0 ? (
            <p className="picker-empty">没有匹配的示例，换个关键词试试。</p>
          ) : (
            groups.map((group) => (
              <section className="picker-section" key={group.category}>
                <h3 className="section-title">{group.category}</h3>
                {group.items.map((sample) => (
                  <button
                    type="button"
                    className={`picker-item${sample.valid === false ? ' invalid' : ''}`}
                    key={sample.id}
                    onClick={() => onPick(sample)}
                    data-testid={`sample-item-${sample.id}`}
                  >
                    <span className="picker-item-main">
                      <span className="picker-item-name">
                        {sample.name}
                        {sample.valid === false ? <span className="picker-tag">故意错误</span> : null}
                      </span>
                      <span className="picker-item-desc">{sample.description}</span>
                      {sample.hint ? <span className="picker-item-hint">{sample.hint}</span> : null}
                    </span>
                    <Icon name="chevron" size={14} />
                  </button>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
