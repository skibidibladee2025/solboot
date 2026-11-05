// VM (Emulator) management

import type { V86Instance, V86Options } from '../types/v86';
import { PROFILES, MB, BOOT_FAIL_REGEX } from '../types/app';
import { err, sleep } from '../utils/helpers';
import { loadV86, getBiosUrl, getRelayUrl, getWasmUrl, asset } from '../assets/loader';
import { makeSnapKey, saveSnapshot as saveSnapshotToOpfs, loadSnapshot as loadSnapshotFromOpfs } from '../storage/opfs';

interface VMConfig {
  ram: number;
  slot: string;
  os: string;
  perf: string;
  driveName: string;
  storageSize: number;
  exe?: { name: string; data: Uint8Array };
}

interface VMState {
  emu: V86Instance | null;
  source: { name: string; size?: number; file?: File; url?: string; ranged?: boolean; fromOpfs?: boolean } | null;
  snapKey: string | null;
  screenText: string;
}

const state: VMState = {
  emu: null,
  source: null,
  snapKey: null,
  screenText: '',
};

export const getState = (): VMState => state;

export const startVM = async (
  config: VMConfig,
  diskOption: { buffer?: File | ArrayBuffer; url?: string; async?: boolean; size?: number },
  onStatusChange: (status: 'loading' | 'running' | 'stopped' | 'error', text: string) => void,
  onError: (message: string, destroy?: boolean) => void,
  onVmNote: (message: string) => void,
  onTagsUpdate: (tags: string[]) => void
): Promise<V86Instance> => {
  const profile = PROFILES[config.os];

  // Load snapshot if resuming
  state.snapKey = makeSnapKey(state.source!, {
    ram: config.ram,
    slot: config.slot,
    os: config.os,
    perf: config.perf,
    driveName: config.driveName,
    storageSize: config.storageSize,
    exe: !!config.exe,
  });

  const initialState = await loadSnapshotFromOpfs(state.snapKey);

  // Load all assets in parallel
  const [bios, vgabios, V86Module] = await Promise.all([
    asset(getBiosUrl('seabios.bin')),
    asset(getBiosUrl('vgabios.bin')),
    loadV86(),
  ]);

  const opts: V86Options = {
    wasm_path: getWasmUrl(),
    bios: { buffer: bios },
    vga_bios: { buffer: vgabios },
    screen_container: document.getElementById('screen')!,
    memory_size: config.ram * MB,
    vga_memory_size: profile.vga * MB,
    acpi: profile.acpi && config.perf !== 'compat',
    fastboot: config.perf === 'fast',
    autostart: true,
    [config.slot]: diskOption,
  };

  if (config.slot === 'cdrom') opts.boot_order = 0x213;
  if (config.exe) opts.filesystem = {}; // empty 9p share
  if (config.exe && !initialState) {
    // The exe will be written after emulator-ready
  }
  const relay = config.exe ? getRelayUrl() : ''; // Simplified - would need relay from UI
  if (relay) opts.network_relay_url = relay;
  if (initialState) opts.initial_state = { buffer: initialState };

  let emu: V86Instance;
  try {
    emu = new V86Module.V86(opts);
  } catch (e) {
    throw new Error(`The emulator failed to start: ${(e as Error).message}`);
  }

  state.emu = emu;
  state.screenText = '';

  // Set up event listeners
  emu.add_listener('download-error', (e: any) => {
    onError(`Could not download ${e?.file_name || 'a required file'} (wasm or remote disk). Check your connection and CORS settings.`);
    teardown();
  });

  emu.add_listener('emulator-ready', () => {
    onStatusChange('loading', initialState ? 'Resuming…' : 'Booting…');
  });

  emu.add_listener('emulator-started', () => {
    onStatusChange('running', 'Running');
  });

  emu.add_listener('emulator-stopped', () => {
    onStatusChange('stopped', 'Stopped');
  });

  // Boot failure detection
  if (!initialState) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChar = (...args: unknown[]) => {
      const ch = args[2] as number;
      state.screenText = (state.screenText + String.fromCharCode(ch)).slice(-400);
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (BOOT_FAIL_REGEX.test(state.screenText)) {
            state.screenText = '';
            onError(
              'The guest could not find a bootable disk. Check that the image has a bootloader ' +
              'and an installed or live OS, and that the right drive slot (hard drive or CD-ROM) is selected.',
              false
            );
          }
        }, 300);
      }
    };
    emu.add_listener('screen-put-char', onChar);
    setTimeout(() => {
      try { emu.remove_listener('screen-put-char', onChar); } catch {}
      if (timer) clearTimeout(timer);
    }, 60000);
  }

  // Setup Wine if exe provided
  if (config.exe) {
    if (!initialState) {
      emu.add_listener('emulator-ready', () => {
        emu.create_file(config.exe!.name, config.exe!.data).catch((e) => {
          onError(`Could not share ${config.exe!.name} with the guest: ${(e as Error).message}`);
        });
      });
    }
  }

  return emu;
};

export const stopVM = (): void => {
  state.emu?.stop();
};

export const resetVM = (): void => {
  if (state.emu) {
    state.emu.restart();
    state.emu.run();
  }
};

export const teardown = (): void => {
  try {
    state.emu?.destroy();
  } catch {}
  state.emu = null;
  state.source = null;
  state.snapKey = null;
  state.screenText = '';
};

export const saveSnapshot = async (): Promise<void> => {
  if (!state.emu || !state.snapKey) return;
  const snapshot = await state.emu.save_state();
  await saveSnapshotToOpfs(state.snapKey, snapshot);
};

export const setSource = (source: VMState['source']): void => {
  state.source = source;
};

export const setEmu = (emu: V86Instance): void => {
  state.emu = emu;
};