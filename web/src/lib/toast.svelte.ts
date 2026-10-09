export interface Toast {
  id: number;
  message: string;
  undo?: () => void | Promise<void>;
  error?: boolean;
}

let seq = 0;
export const toasts = $state<Toast[]>([]);

export function toast(message: string, opts: { undo?: Toast['undo']; error?: boolean; ms?: number } = {}) {
  const t: Toast = { id: ++seq, message, undo: opts.undo, error: opts.error };
  toasts.push(t);
  setTimeout(() => dismiss(t.id), opts.ms ?? (opts.undo ? 6000 : 3500));
}

export function dismiss(id: number) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i !== -1) toasts.splice(i, 1);
}
