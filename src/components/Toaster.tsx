import React from 'react';
import { useToast, ToastVariant } from '../contexts/ToastContext';

const ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
};

const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToast();

  return (
    <>
      <style>{`
        .tst-wrap {
          position: fixed;
          top: calc(var(--mm-header-offset, 60px) + 16px);
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          max-width: 380px;
          width: calc(100vw - 40px);
        }
        .tst {
          pointer-events: auto;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
          display: flex;
          gap: 12px;
          align-items: flex-start;
          animation: tst-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2);
        }
        @keyframes tst-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .tst-icon {
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px; flex-shrink: 0;
          color: #fff;
        }
        .tst.success .tst-icon { background: var(--accent); }
        .tst.error .tst-icon   { background: var(--negative); }
        .tst.info .tst-icon    { background: var(--text-muted); }
        .tst.warning .tst-icon { background: var(--boost, #ea580c); }

        .tst-body { flex: 1; min-width: 0; }
        .tst-title {
          font-size: 14px; font-weight: 600; color: var(--text-primary);
          line-height: 1.3; margin: 1px 0 2px;
          word-break: break-word;
        }
        .tst-msg {
          font-size: 12.5px; color: var(--text-secondary);
          line-height: 1.45; word-break: break-word;
        }
        .tst-link {
          display: inline-block; margin-top: 6px;
          font-size: 12.5px; font-weight: 600;
          color: var(--accent); text-decoration: none;
        }
        .tst-link:hover { text-decoration: underline; }
        .tst-close {
          background: transparent; border: 0;
          color: var(--text-muted); cursor: pointer;
          font-size: 16px; line-height: 1;
          padding: 2px 4px; margin: -2px -4px 0 0;
          border-radius: 6px;
          transition: background 0.1s, color 0.1s;
        }
        .tst-close:hover { background: var(--bg-hover); color: var(--text-primary); }
      `}</style>
      <div className="tst-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`tst ${t.variant}`}>
            <div className="tst-icon">{ICONS[t.variant]}</div>
            <div className="tst-body">
              <div className="tst-title">{t.title}</div>
              {t.message && <div className="tst-msg">{t.message}</div>}
              {t.link && (
                <a href={t.link.href} target="_blank" rel="noopener noreferrer" className="tst-link">
                  {t.link.label} ↗
                </a>
              )}
            </div>
            <button className="tst-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </>
  );
};

export default Toaster;
