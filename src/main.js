import "./style.css";

const BIOS = "https://raw.githubusercontent.com/copy/v86/master/bios/";
const RELAY = "wss://relay.widgetry.org/";
const WASM = `${import.meta.env.BASE_URL}v86.wasm`;
const ASSET_CACHE = "v86-assets-v1";
const MB = 1024 * 1024;
const $ = (s) => document.querySelector(s);
const val = (n) => document.querySelector(`input[name="${n}"]:checked`).value;
const err = (id, m) => { $(id).textContent = m; $(id).hidden = !m; };

const PROFILES = {
  linux: { tags: ["x86", "Linux", "any distro"], vga: 16, acpi: true },
  windows: { tags: ["x86", "Windows", "9x / 2000 / XP"], vga: 32, acpi: false },
  other: { tags: ["x86", "generic"], vga: 16, acpi: false },
};
// v86's typings say guest RAM should be a power of two, and a 32-bit wasm
// address space cannot hold more than 2 GB of it plus emulator overhead.
const RAMS = [32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048];
const RES = [["auto", "Auto (640 × 480)"], ["800x600", "800 × 600"], ["1024x768", "1024 × 768"], ["1280x720", "1280 × 720"],
  ["1280x1024", "1280 × 1024"], ["1366x768", "1366 × 768"], ["1600x900", "1600 × 900"], ["1920x1080", "1920 × 1080"]];
const BOOT_FAIL = /no bootable|boot failed|not a bootable|missing operating system|operating system not found|no boot device|invalid partition|disk read error/i;
const WARN64 = /x86[_-]?64|amd64|x64/i;

let emu = null, source = null, snapKey = null, screenText = "";

const formatStorage = (mb) => {
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
};

$("#ram").innerHTML = RAMS.map((m) => `<option value="${m}" ${m === 512 ? "selected" : ""}>${m >= 1024 ? m / 1024 + " GB" : m + " MB"}</option>`).join("");
$("#res").innerHTML = RES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
$("#storageValue").textContent = formatStorage(Number($("#storageSize").value));

const tags = (el, extra = []) => {
  el.innerHTML = [...PROFILES[$("#os").value].tags, ...extra].map((t) => `<span class="tag">${t}</span>`).join("");
};

function sync() {
  const src = val("src");
  document.querySelectorAll("[data-src]").forEach((e) => (e.hidden = e.dataset.src !== src));
  $("#customRelayWrap").hidden = $("#relay").value !== "custom";
  const name = src === "file" ? $("#file").files[0]?.name : src === "opfs" ? $("#opfsList").value : $("#url").value;
  $("#archWarn").hidden = !WARN64.test(name || "");
  $("#storageValue").textContent = formatStorage(Number($("#storageSize").value));
  tags($("#tags"));
}
$("#config").addEventListener("input", sync);
$("#config").addEventListener("change", (e) => {
  if (e.target.name === "src" && val("src") === "opfs") refreshOpfs();
  sync();
});
$("#opfsRefresh").addEventListener("click", refreshOpfs);

// ---------- loading: lazy v86 module + cached BIOS/wasm ----------
let v86Promise = null;
const loadV86 = () => (v86Promise ??= import("v86").then((m) => {
  const Ctor = m.V86 ?? m.V86Starter; // newer builds export V86, older bundler builds V86Starter
  if (!Ctor) throw new Error("The v86 package did not export V86 or V86Starter.");
  return Ctor;
}).catch((e) => { v86Promise = null; throw e; }));

// BIOS files are fetched once, kept in the Cache API and reused (also works offline afterwards).
async function asset(url) {
  const label = url.split("/").pop();
  let cache = null;
  try {
    cache = await caches.open(ASSET_CACHE);
    const hit = await cache.match(url);
    if (hit) return await hit.arrayBuffer();
  } catch { /* Cache API unavailable (insecure context): fall through to a plain fetch */ }
  let r;
  try { r = await fetch(url); } catch { throw new Error(`Could not download ${label}. Check your connection.`); }
  if (!r.ok) throw new Error(`Could not download ${label} (HTTP ${r.status}).`);
  try { await cache?.put(url, r.clone()); } catch { /* quota or private mode: ignore */ }
  return r.arrayBuffer();
}

// Warm everything the first Start needs while the browser is idle.
let warmed = false;
function warm() {
  if (warmed) return;
  warmed = true;
  const run = () => {
    loadV86().catch(() => {});
    fetch(WASM).catch(() => {});
    asset(BIOS + "seabios.bin").catch(() => {});
    asset(BIOS + "vgabios.bin").catch(() => {});
  };
  "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 1200);
}

// ---------- OPFS ----------
const opfsOk = () => !!navigator.storage?.getDirectory;
const opfsRoot = () => navigator.storage.getDirectory();
const snapDir = async () => (await opfsRoot()).getDirectoryHandle("snapshots", { create: true });

async function refreshOpfs() {
  const sel = $("#opfsList");
  if (!opfsOk()) { sel.innerHTML = "<option value=''>OPFS not supported here</option>"; return; }
  const names = [];
  for await (const [n, h] of (await opfsRoot()).entries()) if (h.kind === "file") names.push(n);
  sel.innerHTML = names.length ? names.map((n) => `<option>${n}</option>`).join("") : "<option value=''>No saved images</option>";
  sync();
}

async function createCustomDrive() {
  const name = $("#driveName").value.trim() || "custom-drive";
  const sizeMb = Number($("#storageSize").value || 128);
  const safeName = `${name.replace(/[^a-z0-9._-]+/gi, "-") || "custom-drive"}.img`;
  const targetBytes = Math.max(8 * MB, sizeMb * 1024 * 1024);

  if (!opfsOk()) return err("#error", "This browser does not support OPFS, so the custom drive cannot be created here.");
  try {
    const estimate = await navigator.storage.estimate();
    const available = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0));
    if (available < targetBytes) {
      const need = Math.max(0, targetBytes - available);
      throw new Error(`Not enough real browser storage. Need ${formatStorage(Math.ceil(need / (1024 * 1024)))} more free space.`);
    }

    const dir = await opfsRoot();
    const writer = await (await dir.getFileHandle(safeName, { create: true })).createWritable();
    const chunk = new Uint8Array(8 * 1024 * 1024);
    const totalChunks = Math.ceil(targetBytes / chunk.length);
    for (let i = 0; i < totalChunks; i++) {
      await writer.write(chunk);
    }
    await writer.close();

    $("#storageStatus").textContent = `Created ${safeName} with ${formatStorage(sizeMb)} and saved in browser storage.`;
    const srcRadio = document.querySelector('input[name="src"][value="opfs"]');
    if (srcRadio) srcRadio.checked = true;
    await refreshOpfs();
    $("#opfsList").value = safeName;
    sync();
  } catch (e) {
    err("#error", e.message || "Could not create the disk image.");
  }
}

// Streams straight to disk: no whole-image copy in memory.
async function saveToOpfs() {
  err("#vmError", "");
  if (!opfsOk()) return err("#vmError", "This browser does not support OPFS.");
  if (!source) return err("#vmError", "There is no disk image to save for this session.");
  if (source.fromOpfs) return err("#vmError", `"${source.name}" is already in browser storage.`);
  const btn = $("#save"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const name = source.name.replace(/[^\w.\-]+/g, "_") || "disk.img";
    const w = await (await (await opfsRoot()).getFileHandle(name, { create: true })).createWritable();
    if (source.file) await source.file.stream().pipeTo(w);
    else {
      const r = await fetch(source.url);
      if (!r.ok || !r.body) throw new Error(`download failed (HTTP ${r.status})`);
      await r.body.pipeTo(w);
    }
    btn.textContent = "Saved";
    refreshOpfs();
  } catch (e) { btn.textContent = "Save to OPFS"; err("#vmError", `Could not save to browser storage: ${e.message}`); }
  setTimeout(() => { btn.textContent = "Save to OPFS"; btn.disabled = false; }, 1500);
}

// ---------- snapshots (instant resume; also persists guest disk changes) ----------
const makeSnapKey = (src, o) =>
  `${src.name}.${src.size ?? 0}.${o.ram}.${o.slot}.${o.os}.${o.perf}.${o.driveName}.${o.storageSize}.${o.exe ? "x" : "n"}`.replace(/[^\w.\-]+/g, "_") + ".state";

async function loadSnapshot(key) {
  if (!opfsOk()) return null;
  try { return await (await (await (await snapDir()).getFileHandle(key)).getFile()).arrayBuffer(); }
  catch { return null; }
}
async function saveSnapshot() {
  err("#vmError", "");
  if (!emu || !snapKey) return;
  if (!opfsOk()) return err("#vmError", "Snapshots need OPFS, which this browser does not support.");
  const btn = $("#snap"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const state = await emu.save_state();
    const w = await (await (await snapDir()).getFileHandle(snapKey, { create: true })).createWritable();
    await w.write(state); await w.close();
    btn.textContent = "Saved";
  } catch (e) { btn.textContent = "Save snapshot"; err("#vmError", `Could not save the snapshot: ${e.message}`); }
  setTimeout(() => { btn.textContent = "Save snapshot"; btn.disabled = false; }, 1500);
}
async function clearSnapshots() {
  try { await (await opfsRoot()).removeEntry("snapshots", { recursive: true }); } catch { /* none saved */ }
  const b = $("#clearSnaps"); b.textContent = "Cleared"; setTimeout(() => (b.textContent = "Clear snapshots"), 1500);
}

// ---------- disk ----------
async function checkFile(file, slot) {
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  if (file.size < 512) throw new Error(`"${file.name}" is too small to be a disk image.`);
  if (slot === "cdrom") return;
  let b;
  try { b = new Uint8Array(await file.slice(510, 512).arrayBuffer()); } // reads 2 bytes, not the whole image
  catch { throw new Error(`"${file.name}" could not be read. It may have been moved, deleted or is no longer accessible.`); }
  if (b[0] !== 0x55 || b[1] !== 0xaa)
    throw new Error(`"${file.name}" has no boot signature. Use a raw disk image with a bootloader (not qcow2, vmdk or compressed), or attach an ISO as CD-ROM.`);
}

async function resolveDisk(slot) {
  const mode = val("src");
  if (mode === "url") {
    const url = $("#url").value.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("Enter a valid http(s) image URL.");
    let r;
    try {
      r = await fetch(url, { headers: { Range: "bytes=0-0" } }); // one tiny request: reachability + range support + size
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) { throw new Error(`The remote image is unreachable (${e.message}). Check the URL and that the server allows CORS.`); }
    r.body?.cancel().catch(() => {});
    const ranged = r.status === 206;
    const size = +(r.headers.get("content-range") || "").split("/")[1] || undefined;
    source = { name: decodeURIComponent(url.split("/").pop().split("?")[0]) || "remote.img", size, url, ranged };
    return { url, async: ranged, ...(size && { size }) };
  }
  let file;
  if (mode === "file") {
    file = $("#file").files[0];
    if (!file) throw new Error("Choose a disk image file first.");
  } else {
    const name = $("#opfsList").value;
    if (!opfsOk()) throw new Error("OPFS is not supported in this browser.");
    if (!name) throw new Error("No saved image selected. Boot one from a file or URL and use “Save to OPFS”.");
    try { file = await (await (await opfsRoot()).getFileHandle(name)).getFile(); }
    catch { throw new Error(`Saved image "${name}" is missing or unreadable.`); }
  }
  await checkFile(file, slot);
  source = { name: file.name, size: file.size, file, fromOpfs: mode === "opfs" };
  // A File is read lazily in chunks (async: true), so even multi-GB images start fast.
  return { buffer: file, async: true };
}

async function readExe() {
  const f = $("#exe").files[0];
  if (!f) return null;
  if (!/\.(exe|msi|bat|com)$/i.test(f.name)) throw new Error(`"${f.name}" is not a Windows program (.exe, .msi, .bat or .com).`);
  try { return { name: f.name.replace(/[^\w.\-]+/g, "_"), data: new Uint8Array(await f.arrayBuffer()) }; }
  catch { throw new Error(`"${f.name}" could not be read. It may have been moved or deleted.`); }
}

// ---------- VM ----------
const status = (cls, text) => { $("#dot").className = "dot " + cls; $("#statusText").textContent = text; };
const frameWidth = () => ($("#res").value === "auto" ? 1024 : +$("#res").value.split("x")[0]) + "px";
function showVm() {
  $("#config").hidden = true; $("#vm").hidden = false;
  err("#vmError", ""); $("#vmNote").hidden = true;
  $("#stage").style.setProperty("--w", frameWidth());
}

async function startV86() {
  const slot = $("#slot").value, btn = $("#start");
  const relay = $("#relay").value;
  const relayUrl = relay === "public" ? RELAY : relay === "custom" ? $("#customRelay").value.trim() : "";
  if (relay === "custom" && !/^wss?:\/\//i.test(relayUrl)) return err("#error", "Custom relay must start with ws:// or wss://.");

  btn.disabled = true; btn.textContent = "Loading…";
  let drive, exe, bios, vgabios, V86, state = null;
  const driveName = $("#driveName").value.trim() || "Custom VM";
  const storageSize = Number($("#storageSize").value || 0);
  const o = { ram: $("#ram").value, slot, os: $("#os").value, perf: $("#perf").value, driveName, storageSize };
  try {
    // Everything independent loads in parallel: disk check, .exe, BIOS files and the emulator module.
    [drive, exe, bios, vgabios, V86] = await Promise.all([
      resolveDisk(slot), readExe(), asset(BIOS + "seabios.bin"), asset(BIOS + "vgabios.bin"), loadV86(),
    ]);
    snapKey = makeSnapKey(source, { ...o, exe: !!exe });
    if ($("#resume").checked) state = await loadSnapshot(snapKey);
  } catch (e) { return err("#error", e.message); }
  finally { btn.disabled = false; btn.textContent = "Start VM"; }

  const profile = PROFILES[o.os];
  showVm(); status("loading", state ? "Restoring snapshot…" : "Loading BIOS…"); screenText = "";
  tags($("#vmTags"), [$("#ram").selectedOptions[0].text, relayUrl ? "online" : "offline", driveName, formatStorage(storageSize)]);
  if (source.url && !source.ranged) {
    $("#vmNote").textContent = "This server does not support range requests, so the whole image is downloading before boot. Use a host with HTTP Range support for faster starts.";
    $("#vmNote").hidden = false;
  }

  const opts = {
    wasm_path: WASM,
    bios: { buffer: bios },
    vga_bios: { buffer: vgabios },
    screen_container: $("#screen"),
    memory_size: +o.ram * MB,
    vga_memory_size: profile.vga * MB,
    acpi: profile.acpi && o.perf !== "compat",
    fastboot: o.perf === "fast",
    autostart: true,
    [slot]: drive,
  };
  if (slot === "cdrom") opts.boot_order = 0x213;
  if (exe) opts.filesystem = {}; // empty 9p share the host can write into
  if (relayUrl) opts.network_relay_url = relayUrl;
  if (state) opts.initial_state = { buffer: state };

  try { emu = new V86(opts); } catch (e) { return fail(`The emulator failed to start: ${e.message}`); }
  const vm = emu;
  vm.add_listener("download-error", (e) => fail(`Could not download ${e?.file_name || "a required file"} (wasm or remote disk). Check your connection and CORS settings.`));
  vm.add_listener("emulator-ready", () => status("loading", state ? "Resuming…" : "Booting…"));
  vm.add_listener("emulator-started", () => status("running", "Running"));
  vm.add_listener("emulator-stopped", () => status("", "Stopped"));

  // Boot-failure detection: collect characters and test once per 300 ms burst instead of per character,
  // and stop listening after 60 s since BIOS failures show up immediately.
  if (!state) {
    let timer = 0;
    const onChar = ([, , ch]) => {
      screenText = (screenText + String.fromCharCode(ch)).slice(-400);
      timer ||= setTimeout(() => {
        timer = 0;
        if (BOOT_FAIL.test(screenText)) {
          screenText = "";
          fail("The guest could not find a bootable disk. Check that the image has a bootloader and an installed or live OS, and that the right drive slot (hard drive or CD-ROM) is selected.", false);
        }
      }, 300);
    };
    vm.add_listener("screen-put-char", onChar);
    setTimeout(() => { try { vm.remove_listener("screen-put-char", onChar); } catch {} clearTimeout(timer); }, 60000);
  }
  setupWine(exe, !!state);
}
function fail(msg, destroy = true) {
  status("error", "Error"); err("#vmError", msg);
  if (destroy) teardown();
}
function teardown() { try { emu?.destroy(); } catch {} emu = null; }

// Wine: the .exe is written into a 9p share; "Run .exe" types the mount + wine command into the guest.
function setupWine(exe, restored) {
  $("#wineRun").hidden = !exe; $("#wineHint").hidden = !exe;
  if (!exe) return;
  // A restored snapshot already contains the share, so the file is not written again.
  if (!restored)
    emu.add_listener("emulator-ready", () =>
      emu.create_file(exe.name, exe.data).catch((e) => err("#vmError", `Could not share ${exe.name} with the guest: ${e.message}`)));
  $("#wineRun").onclick = () => emu?.keyboard_send_text(
    `mkdir -p /mnt/win; mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt/win; wine "/mnt/win/${exe.name}"\n`);
}

$("#createDrive").addEventListener("click", createCustomDrive);
$("#start").addEventListener("click", () => { err("#error", ""); return startV86(); });
$("#stop").addEventListener("click", () => {
  emu?.stop();
  status("", "Stopped");
});
$("#reset").addEventListener("click", () => {
  err("#vmError", "");
  if (emu) { emu.restart(); emu.run(); }
  else return;
  status("running", "Running");
});
$("#back").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  teardown(); source = null; snapKey = null;
  for (const id of ["#wineRun", "#wineHint", "#vmNote"]) $(id).hidden = true;
  $("#screen").hidden = false; $("#save").hidden = false; $("#snap").hidden = false;
  $("#screen").innerHTML = '<div class="text"></div><canvas></canvas>';
  $("#vm").hidden = true; $("#config").hidden = false;
});
$("#save").addEventListener("click", saveToOpfs);
$("#snap").addEventListener("click", saveSnapshot);
$("#clearSnaps").addEventListener("click", clearSnapshots);

// ---------- fullscreen ----------
$("#fs").addEventListener("click", async () => {
  try { document.fullscreenElement ? await document.exitFullscreen() : await $("#stage").requestFullscreen(); }
  catch (e) { err("#vmError", `Fullscreen is not available: ${e.message}`); }
});
document.addEventListener("fullscreenchange", () => ($("#fs").textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen"));

sync();
refreshOpfs();
warm();
