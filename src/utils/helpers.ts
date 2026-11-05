// Utility functions

export const $ = <T extends Element>(selector: string): T | null => document.querySelector(selector);

export const $$ = <T extends Element>(selector: string): T => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element as T;
};

export const val = (name: string): string => {
  const element = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null;
  return element?.value ?? '';
};

export const err = (id: string, message: string): void => {
  const el = $(id) as HTMLElement | null;
  if (el) {
    el.textContent = message;
    el.hidden = !message;
  }
};

export const formatStorage = (mb: number): string => {
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
};

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-z0-9._-]+/gi, '-') || 'unnamed';

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

export const isValidWsUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.startsWith('ws://') || url.startsWith('wss://');
  } catch {
    return false;
  }
};