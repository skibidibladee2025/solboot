// Type definitions for v86
// Based on the v86 package types

export interface V86Options {
  wasm_path: string;
  bios: { buffer: ArrayBuffer };
  vga_bios: { buffer: ArrayBuffer };
  screen_container: HTMLElement;
  memory_size: number;
  vga_memory_size: number;
  acpi: boolean;
  fastboot: boolean;
  autostart: boolean;
  hda?: DiskOption;
  hdb?: DiskOption;
  hdc?: DiskOption;
  hdd?: DiskOption;
  cdrom?: DiskOption;
  boot_order?: number;
  filesystem?: Record<string, unknown>;
  network_relay_url?: string;
  initial_state?: { buffer: ArrayBuffer };
}

export interface DiskOption {
  buffer?: File | ArrayBuffer;
  url?: string;
  async?: boolean;
  size?: number;
}

export interface V86Instance {
  run(): void;
  stop(): void;
  restart(): void;
  destroy(): void;
  save_state(): Promise<ArrayBuffer>;
  create_file(name: string, data: Uint8Array): Promise<void>;
  keyboard_send_text(text: string): void;
  add_listener(event: string, callback: (...args: unknown[]) => void): void;
  remove_listener(event: string, callback: (...args: unknown[]) => void): void;
}

export interface V86Module {
  V86: new (options: V86Options) => V86Instance;
  V86Starter?: new (options: V86Options) => V86Instance;
}

declare module 'v86' {
  const V86: new (options: V86Options) => V86Instance;
  const V86Starter: new (options: V86Options) => V86Instance;
  export { V86, V86Starter };
  export default { V86, V86Starter };
}