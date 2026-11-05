// Disk handling operations

import { DiskSource, SlotType, BOOT_FAIL_REGEX, WARN64_REGEX } from '../types/app';
import { err, isValidUrl } from '../utils/helpers';

export const checkFile = async (file: File, slot: SlotType): Promise<void> => {
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  if (file.size < 512) throw new Error(`"${file.name}" is too small to be a disk image.`);
  if (slot === 'cdrom') return;

  // Read only 2 bytes for boot signature check (not the whole image)
  let bootSignature: Uint8Array;
  try {
    bootSignature = new Uint8Array(await file.slice(510, 512).arrayBuffer());
  } catch {
    throw new Error(`"${file.name}" could not be read. It may have been moved, deleted or is no longer accessible.`);
  }

  if (bootSignature[0] !== 0x55 || bootSignature[1] !== 0xaa) {
    throw new Error(
      `"${file.name}" has no boot signature. Use a raw disk image with a bootloader ` +
      `(not qcow2, vmdk or compressed), or attach an ISO as CD-ROM.`
    );
  }
};

export const checkArchWarning = (name: string): boolean => WARN64_REGEX.test(name || '');

export const resolveDisk = async (
  sourceType: 'file' | 'opfs' | 'url',
  slot: SlotType,
  fileInput: HTMLInputElement,
  opfsSelect: HTMLSelectElement,
  urlInput: HTMLInputElement
): Promise<{ diskOption: { buffer?: File | ArrayBuffer; url?: string; async?: boolean; size?: number }; source: DiskSource }> => {
  if (sourceType === 'url') {
    const url = urlInput.value.trim();
    if (!isValidUrl(url)) throw new Error('Enter a valid http(s) image URL.');

    let response: Response;
    try {
      // One tiny request: reachability + range support + size
      response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e) {
      throw new Error(`The remote image is unreachable (${(e as Error).message}). Check the URL and that the server allows CORS.`);
    }

    response.body?.cancel().catch(() => {});
    const ranged = response.status === 206;
    const size = Number((response.headers.get('content-range') || '').split('/')[1]) || undefined;

    const source: DiskSource = {
      name: decodeURIComponent(url.split('/').pop()?.split('?')[0] || '') || 'remote.img',
      size,
      url,
      ranged,
    };

    return { diskOption: { url, async: ranged, ...(size && { size }) }, source };
  }

  let file: File;

  if (sourceType === 'file') {
    file = fileInput.files?.[0]!;
    if (!file) throw new Error('Choose a disk image file first.');
  } else {
    // OPFS
    const name = opfsSelect.value;
    if (!name) throw new Error('No saved image selected. Boot one from a file or URL and use "Save to OPFS".');
    try {
      // We need to import the opfs module here to get the file
      const { getOpfsRoot } = await import('../storage/opfs');
      const root = await getOpfsRoot();
      file = await (await root.getFileHandle(name)).getFile();
    } catch {
      throw new Error(`Saved image "${name}" is missing or unreadable.`);
    }
  }

  await checkFile(file, slot);

  const source: DiskSource = {
    name: file.name,
    size: file.size,
    file,
    fromOpfs: sourceType === 'opfs',
  };

  // A File is read lazily in chunks (async: true), so even multi-GB images start fast
  return { diskOption: { buffer: file, async: true }, source };
};

export const readExeFile = async (exeInput: HTMLInputElement): Promise<{ name: string; data: Uint8Array } | null> => {
  const file = exeInput.files?.[0];
  if (!file) return null;

  if (!/\.(exe|msi|bat|com)$/i.test(file.name)) {
    throw new Error(`"${file.name}" is not a Windows program (.exe, .msi, .bat or .com).`);
  }

  try {
    return {
      name: file.name.replace(/[^\w.\-]+/g, '_'),
      data: new Uint8Array(await file.arrayBuffer()),
    };
  } catch {
    throw new Error(`"${file.name}" could not be read. It may have been moved or deleted.`);
  }
};