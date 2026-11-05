// Unit tests for OPFS storage functions

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSnapKey } from './opfs';

describe('makeSnapKey', () => {
  it('generates consistent snapshot keys', () => {
    const source = { name: 'test.img', size: 1024 * 1024 * 100 };
    const options = {
      ram: 512,
      slot: 'hda',
      os: 'linux',
      perf: 'balanced',
      driveName: 'Test VM',
      storageSize: 128,
      exe: false,
    };

    const key1 = makeSnapKey(source, options);
    const key2 = makeSnapKey(source, options);

    expect(key1).toBe(key2);
    expect(key1).toContain('test.img');
    expect(key1).toContain('512');
    expect(key1).toContain('hda');
    expect(key1).toContain('linux');
    expect(key1).toContain('balanced');
    expect(key1).toContain('Test_VM');
    expect(key1).toContain('128');
    expect(key1.endsWith('.state')).toBe(true);
  });

  it('includes exe flag in key', () => {
    const source = { name: 'test.img', size: 1024 * 1024 * 100 };
    const options = {
      ram: 512,
      slot: 'hda',
      os: 'linux',
      perf: 'balanced',
      driveName: 'Test VM',
      storageSize: 128,
      exe: true,
    };

    const key = makeSnapKey(source, options);
    expect(key).toContain('.x.');
  });

  it('handles missing source size', () => {
    const source = { name: 'test.img' };
    const options = {
      ram: 512,
      slot: 'hda',
      os: 'linux',
      perf: 'balanced',
      driveName: 'Test VM',
      storageSize: 128,
      exe: false,
    };

    const key = makeSnapKey(source, options);
    expect(key).toContain('test.img.0.512');
  });

  it('sanitizes special characters', () => {
    const source = { name: 'test@#$.img', size: 100 };
    const options = {
      ram: 512,
      slot: 'hda',
      os: 'linux',
      perf: 'balanced',
      driveName: 'Test/VM',
      storageSize: 128,
      exe: false,
    };

    const key = makeSnapKey(source, options);
    expect(key).not.toContain('@');
    expect(key).not.toContain('#');
    expect(key).not.toContain('$');
    expect(key).not.toContain('/');
  });
});