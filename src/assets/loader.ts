// Asset loading with Cache API

import { BIOS_BASE, RELAY_URL, ASSET_CACHE_NAME, WASM_PATH } from '../types/app';

const WASM = WASM_PATH || `${import.meta.env.BASE_URL}v86.wasm`;

let v86Promise: Promise<{ V86: new (options: any) => any }> | null = null;
let warmed = false;

export const loadV86 = async (): Promise<{ V86: new (options: any) => any }> => {
  if (!v86Promise) {
    v86Promise = import('v86').then((module) => {
      const Ctor = module.V86 ?? module.V86Starter;
      if (!Ctor) throw new Error('The v86 package did not export V86 or V86Starter.');
      return { V86: Ctor };
    }).catch((e) => {
      v86Promise = null;
      throw e;
    });
  }
  return v86Promise;
};

export const asset = async (url: string): Promise<ArrayBuffer> => {
  const label = url.split('/').pop() || 'asset';
  let cache: Cache | null = null;

  try {
    cache = await caches.open(ASSET_CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return hit.arrayBuffer();
  } catch {
    // Cache API unavailable (insecure context): fall through to plain fetch
  }

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Could not download ${label}. Check your connection.`);
  }

  if (!response.ok) throw new Error(`Could not download ${label} (HTTP ${response.status}).`);

  try {
    await cache?.put(url, response.clone());
  } catch {
    // Quota or private mode: ignore
  }

  return response.arrayBuffer();
};

export const warmAssets = (): void => {
  if (warmed) return;
  warmed = true;

  const run = (): void => {
    loadV86().catch(() => {});
    fetch(WASM).catch(() => {});
    asset(BIOS_BASE + 'seabios.bin').catch(() => {});
    asset(BIOS_BASE + 'vgabios.bin').catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1200);
  }
};

export const getBiosUrl = (name: 'seabios.bin' | 'vgabios.bin'): string => BIOS_BASE + name;

export const getRelayUrl = (): string => RELAY_URL;

export const getWasmUrl = (): string => WASM;