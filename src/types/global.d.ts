// Global type declarations for OPFS and Service Worker

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface ServiceWorkerGlobalScope extends WorkerGlobalScope {
  skipWaiting(): Promise<void>;
  clients: Clients;
  registration: ServiceWorkerRegistration;
}

interface ExtendableEvent extends Event {
  waitUntil(f: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(r: Response | Promise<Response>): void;
}

declare const self: ServiceWorkerGlobalScope;