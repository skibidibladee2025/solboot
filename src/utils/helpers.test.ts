// Unit tests for helper functions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatStorage,
  sleep,
  debounce,
  sanitizeFilename,
  isValidUrl,
  isValidWsUrl,
} from './helpers';

describe('formatStorage', () => {
  it('formats MB correctly', () => {
    expect(formatStorage(128)).toBe('128 MB');
    expect(formatStorage(512)).toBe('512 MB');
    expect(formatStorage(1023)).toBe('1023 MB');
  });

  it('formats GB correctly', () => {
    expect(formatStorage(1024)).toBe('1.00 GB');
    expect(formatStorage(2048)).toBe('2.00 GB');
    expect(formatStorage(1536)).toBe('1.50 GB');
  });

  it('formats TB correctly', () => {
    expect(formatStorage(1024 * 1024)).toBe('1.00 TB');
    expect(formatStorage(2 * 1024 * 1024)).toBe('2.00 TB');
  });
});

describe('sleep', () => {
  it('resolves after specified time', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
    expect(elapsed).toBeLessThan(200);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledWith('arg1');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1');
    vi.advanceTimersByTime(50);
    debounced('arg2');
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledWith('arg2');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sanitizeFilename', () => {
  it('replaces invalid characters with hyphens', () => {
    expect(sanitizeFilename('test file.img')).toBe('test-file.img');
    expect(sanitizeFilename('my@vm#1.img')).toBe('my-vm-1.img');
    expect(sanitizeFilename('path/to/file.img')).toBe('path-to-file.img');
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
  });

  it('preserves valid characters', () => {
    expect(sanitizeFilename('valid-name.img')).toBe('valid-name.img');
    expect(sanitizeFilename('test_file.img')).toBe('test_file.img');
  });
});

describe('isValidUrl', () => {
  it('returns true for valid HTTP URLs', () => {
    expect(isValidUrl('http://example.com/file.img')).toBe(true);
    expect(isValidUrl('https://example.com/file.img')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidUrl('ftp://example.com/file.img')).toBe(false);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('isValidWsUrl', () => {
  it('returns true for valid WebSocket URLs', () => {
    expect(isValidWsUrl('ws://example.com/relay')).toBe(true);
    expect(isValidWsUrl('wss://example.com/relay')).toBe(true);
  });

  it('returns false for invalid WebSocket URLs', () => {
    expect(isValidWsUrl('http://example.com/relay')).toBe(false);
    expect(isValidWsUrl('https://example.com/relay')).toBe(false);
    expect(isValidWsUrl('not-a-url')).toBe(false);
    expect(isValidWsUrl('')).toBe(false);
  });
});