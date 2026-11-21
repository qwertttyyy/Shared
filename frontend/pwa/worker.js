/* global build */
const cachePrefix = `shared-shell:${self.registration.scope}:`
const cacheName = `${cachePrefix}${build.version}`
const staticFiles = new Set(build.files)

async function precache() {
  const cache = await caches.open(cacheName)
  try {
    await cache.addAll(build.files.map(path => new Request(path, { cache: 'reload', credentials: 'omit', redirect: 'error' })))
  } catch (error) {
    await caches.delete(cacheName)
    throw error
  }
}

async function activate() {
  const keys = await caches.keys()
  await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)))
  await self.clients.claim()
}

async function cachedOrNetwork(path, request) {
  const response = await caches.match(path, { cacheName }).catch(() => undefined)
  return response ?? fetch(request)
}

self.addEventListener('install', event => event.waitUntil(precache()))
self.addEventListener('activate', event => event.waitUntil(activate()))

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(cachedOrNetwork(build.shell, request))
  } else if (staticFiles.has(url.pathname) && !url.search) {
    event.respondWith(cachedOrNetwork(url.pathname, request))
  }
})
