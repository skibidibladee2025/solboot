# solboot (Vite + v86)

    npm install
    npm run dev      # http://localhost:5173
    npm run build && npm run preview

## Engine
- **v86:** boots raw 32-bit disk images from a file, OPFS or a URL. 64-bit guests are not supported by v86.

## Speed
- Local and OPFS images are passed to v86 as a `File` with `async: true`, so they are read lazily in chunks instead of being loaded into memory.
- The boot-signature check reads 2 bytes, not the whole image.
- BIOS files are downloaded once from the official v86 repo, then served from the Cache API. The v86 module and wasm are warmed while the browser is idle.
- Disk, .exe, BIOS and the emulator module load in parallel.
- Remote images use one 1-byte Range request to check reachability, range support and size. Servers without Range support fall back to a full download, with a note.
- "Save snapshot" stores the whole machine state in OPFS; the next Start resumes it instantly and keeps guest disk changes. A snapshot only matches the same disk, RAM, slot, guest type, performance mode and .exe setting.
- "Save to OPFS" streams the image to disk without copying it into memory.

## Wine
Choose a .exe on the config screen. It is written into a 9p share; press "Run .exe" and the app types the mount and `wine` command into the guest. The guest image needs i386 Wine and 9p support.

## Notes
- RAM options are powers of two up to 2 GB (v86's typings recommend powers of two; a 32-bit wasm address space cannot hold more).
- Remote images need CORS and, ideally, HTTP Range support. Use raw images, not qcow2 or vmdk.
- Not run-tested: `npm install` was not possible when this was written, so the v86 version range (`^0.5.0`) and the `File`-as-disk path should be confirmed on first run.

## New Features & Improvements

### TypeScript & Code Quality
- Full TypeScript support with strict type checking
- ESLint + Prettier for consistent code style
- Modular architecture with separate modules for UI, storage, disk, VM, assets, config
- Unit tests with Vitest

### PWA Support
- Service worker for offline caching of static assets and v86 BIOS/WASM files
- Web App Manifest for installable PWA experience
- Works offline after first visit

### Accessibility
- Proper ARIA labels, roles, and live regions
- Keyboard navigation support
- Screen reader compatible
- Focus indicators and semantic HTML
- Descriptive help text for all form controls

### VM Configuration Export/Import
- Export VM configuration as JSON file
- Import VM configuration from JSON file
- Share VM setups with others or backup your configurations

### CI/CD Pipeline
- GitHub Actions workflow for linting, testing, type-checking, and building
- Automated preview deployments for pull requests
- Production deployment on merge to main

### Performance
- Lazy loading of v86 module and assets
- Parallel loading of independent resources
- Code splitting for v86 dependency
- Cache API for BIOS/WASM files

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Check formatting
npm run format

# Run tests
npm run test

# Type check
npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview
```

## Browser Support
- Chrome/Edge 89+
- Firefox 78+
- Safari 15.2+
- Requires: WASM, SharedArrayBuffer, OPFS (for browser storage features)

## Security Notes
- Disk images never leave your device (processed locally in browser)
- OPFS storage is origin-isolated
- Network relay is optional and only used when explicitly enabled
- No server-side processing - everything runs client-side