import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
  link?: { label: string; href: string };
  duration?: number;
}

interface ToastCtx {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => number;
  success: (title: string, message?: string, link?: Toast['link']) => number;
  error: (title: string, message?: string) => number;
  info: (title: string, message?: string) => number;
  warning: (title: string, message?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastCtx>({
  toasts: [],
  push: () => 0,
  success: () => 0,
  error: () => 0,
  info: () => 0,
  warning: () => 0,
  dismiss: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = idRef.current++;
    const toast: Toast = { id, duration: 5000, ...t };
    setToasts(prev => [...prev, toast]);
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((title: string, message?: string, link?: Toast['link']) =>
    push({ variant: 'success', title, message, link }), [push]);
  const error = useCallback((title: string, message?: string) =>
    push({ variant: 'error', title, message, duration: 8000 }), [push]);
  const info = useCallback((title: string, message?: string) =>
    push({ variant: 'info', title, message }), [push]);
  const warning = useCallback((title: string, message?: string) =>
    push({ variant: 'warning', title, message, duration: 7000 }), [push]);

  return (
    <ToastContext.Provider value={{ toasts, push, success, error, info, warning, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
