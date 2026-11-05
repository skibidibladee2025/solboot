// OPFS (Origin Private File System) operations

import { MB } from '../types/app';

export const opfsOk = (): boolean => !!navigator.storage?.getDirectory;

export const getOpfsRoot = async (): Promise<FileSystemDirectoryHandle> => {
  if (!opfsOk()) throw new Error('OPFS not supported in this browser');
  return navigator.storage.getDirectory();
};

export const getSnapshotsDir = async (): Promise<FileSystemDirectoryHandle> => {
  const root = await getOpfsRoot();
  return root.getDirectoryHandle('snapshots', { create: true });
};

export const listOpfsFiles = async (): Promise<string[]> => {
  if (!opfsOk()) return [];
  const root = await getOpfsRoot();
  const names: string[] = [];
  for await (const [name, handle] of root.entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (handle.kind === 'file') names.push(name);
  }
  return names;
};

export const refreshOpfs = async (): Promise<void> => {
  const sel = document.getElementById('opfsList') as HTMLSelectElement;
  if (!sel) return;
  const names = await listOpfsFiles();
  sel.innerHTML = names.length
    ? names.map((n) => `<option>${n}</option>`).join('')
    : "<option value=''>No saved images</option>";
};

export const createCustomDrive = async (
  name: string,
  sizeMb: number
): Promise<string> => {
  if (!opfsOk()) throw new Error('This browser does not support OPFS');

  const safeName = `${name.replace(/[^a-z0-9._-]+/gi, '-') || 'custom-drive'}.img`;
  const targetBytes = Math.max(8 * MB, sizeMb * 1024 * 1024);

  // Check available storage
  const estimate = await navigator.storage.estimate();
  const available = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0));
  if (available < targetBytes) {
    const need = Math.max(0, targetBytes - available);
    const needMb = Math.ceil(need / (1024 * 1024));
    throw new Error(`Not enough real browser storage. Need ${needMb} MB more free space.`);
  }

  const root = await getOpfsRoot();
  const writer = await (await root.getFileHandle(safeName, { create: true })).createWritable();
  const chunk = new Uint8Array(8 * 1024 * 1024);
  const totalChunks = Math.ceil(targetBytes / chunk.length);

  for (let i = 0; i < totalChunks; i++) {
    await writer.write(chunk);
  }
  await writer.close();

  return safeName;
};

export const saveToOpfs = async (
  source: { name: string; file?: File; url?: string },
  onProgress?: (progress: number) => void
): Promise<string> => {
  if (!opfsOk()) throw new Error('This browser does not support OPFS');

  const safeName = source.name.replace(/[^\w.\-]+/g, '_') || 'disk.img';
  const root = await getOpfsRoot();
  const writer = await (await root.getFileHandle(safeName, { create: true })).createWritable();

  if (source.file) {
    // Stream from File
    const stream = source.file.stream();
    const reader = stream.getReader();
    let totalRead = 0;
    const totalSize = source.file.size;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      totalRead += value.length;
      onProgress?.(totalRead / totalSize);
    }
  } else if (source.url) {
    // Stream from URL
    const response = await fetch(source.url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (HTTP ${response.status})`);
    }
    const reader = response.body.getReader();
    const totalSize = Number(response.headers.get('content-length') || 0);
    let totalRead = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      totalRead += value.length;
      if (totalSize > 0) onProgress?.(totalRead / totalSize);
    }
  }

  await writer.close();
  return safeName;
};

export const loadSnapshot = async (key: string): Promise<ArrayBuffer | null> => {
  if (!opfsOk()) return null;
  try {
    const dir = await getSnapshotsDir();
    const handle = await dir.getFileHandle(key);
    const file = await handle.getFile();
    return file.arrayBuffer();
  } catch {
    return null;
  }
};

export const saveSnapshot = async (key: string, state: ArrayBuffer): Promise<void> => {
  if (!opfsOk()) throw new Error('Snapshots need OPFS, which this browser does not support');
  const dir = await getSnapshotsDir();
  const writer = await (await dir.getFileHandle(key, { create: true })).createWritable();
  await writer.write(state);
  await writer.close();
};

export const clearSnapshots = async (): Promise<void> => {
  if (!opfsOk()) return;
  try {
    const root = await getOpfsRoot();
    await root.removeEntry('snapshots', { recursive: true });
  } catch {
    // No snapshots to clear
  }
};

export const makeSnapKey = (source: { name: string; size?: number }, options: {
  ram: number;
  slot: string;
  os: string;
  perf: string;
  driveName: string;
  storageSize: number;
  exe: boolean;
}): string => {
  return `${source.name}.${source.size ?? 0}.${options.ram}.${options.slot}.${options.os}.${options.perf}.${options.driveName}.${options.storageSize}.${options.exe ? 'x' : 'n'}`
    .replace(/[^\w.\-]+/g, '_') + '.state';
};