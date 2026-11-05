// Application type definitions

export interface Profile {
  tags: string[];
  vga: number;
  acpi: boolean;
}

export interface Resolution {
  value: string;
  label: string;
}

export interface RamOption {
  value: number;
  label: string;
}

export interface OSProfile {
  value: string;
  label: string;
}

export interface PerformanceProfile {
  value: string;
  label: string;
}

export interface DiskSource {
  name: string;
  size?: number;
  file?: File;
  url?: string;
  ranged?: boolean;
  fromOpfs?: boolean;
}

export interface ExeFile {
  name: string;
  data: Uint8Array;
}

export interface VMOptions {
  ram: number;
  slot: string;
  os: string;
  perf: string;
  driveName: string;
  storageSize: number;
  exe?: ExeFile;
}

export interface SnapshotKeyParts {
  name: string;
  size: number;
  ram: number;
  slot: string;
  os: string;
  perf: string;
  driveName: string;
  storageSize: number;
  exe: boolean;
}

export type DiskSourceType = 'file' | 'opfs' | 'url';
export type RelayType = 'public' | 'custom' | 'off';
export type SlotType = 'hda' | 'hdb' | 'hdc' | 'hdd' | 'cdrom';

export const PROFILES: Record<string, Profile> = {
  linux: { tags: ['x86', 'Linux', 'any distro'], vga: 16, acpi: true },
  windows: { tags: ['x86', 'Windows', '9x / 2000 / XP'], vga: 32, acpi: false },
  other: { tags: ['x86', 'generic'], vga: 16, acpi: false },
};

export const RAMS = [32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048];

export const RESOLUTIONS: Resolution[] = [
  { value: 'auto', label: 'Auto (640 × 480)' },
  { value: '800x600', label: '800 × 600' },
  { value: '1024x768', label: '1024 × 768' },
  { value: '1280x720', label: '1280 × 720' },
  { value: '1280x1024', label: '1280 × 1024' },
  { value: '1366x768', label: '1366 × 768' },
  { value: '1600x900', label: '1600 × 900' },
  { value: '1920x1080', label: '1920 × 1080' },
];

export const OS_OPTIONS: OSProfile[] = [
  { value: 'linux', label: 'Linux (any distribution)' },
  { value: 'windows', label: 'Windows 9x / 2000 / XP' },
  { value: 'other', label: 'Other x86 (DOS, BSD, Haiku)' },
];

export const PERF_OPTIONS: PerformanceProfile[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'fast', label: 'Fast boot' },
  { value: 'compat', label: 'Compatibility (ACPI off)' },
];

export const SLOTS: { value: SlotType; label: string }[] = [
  { value: 'hda', label: 'Hard drive 1' },
  { value: 'hdb', label: 'Hard drive 2' },
  { value: 'hdc', label: 'Hard drive 3' },
  { value: 'hdd', label: 'Hard drive 4' },
  { value: 'cdrom', label: 'CD-ROM / ISO (boots first)' },
];

export const RELAY_OPTIONS: { value: RelayType; label: string }[] = [
  { value: 'public', label: 'Public relay' },
  { value: 'custom', label: 'Custom WebSocket relay' },
  { value: 'off', label: 'Offline' },
];

export const MB = 1024 * 1024;

export const formatStorage = (mb: number): string => {
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
};

export const BIOS_BASE = 'https://raw.githubusercontent.com/copy/v86/master/bios/';
export const RELAY_URL = 'wss://relay.widgetry.org/';
export const WASM_PATH = `${import.meta.env.BASE_URL}v86.wasm`;
export const ASSET_CACHE_NAME = 'v86-assets-v1';
export const BOOT_FAIL_REGEX = /no bootable|boot failed|not a bootable|missing operating system|operating system not found|no boot device|invalid partition|disk read error/i;
export const WARN64_REGEX = /x86[_-]?64|amd64|x64/i;