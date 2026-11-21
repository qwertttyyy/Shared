type InstallPromptEvent = Event & { prompt: () => Promise<unknown> }

let installPrompt: InstallPromptEvent | undefined
let updateWaiting = false
const listeners = new Set<() => void>()

export function subscribeToPwa(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const canInstallApp = () => Boolean(installPrompt)
export const hasAppUpdate = () => updateWaiting

function notifyListeners() {
  for (const listener of listeners) listener()
}

function clearInstallPrompt() {
  installPrompt = undefined
  notifyListeners()
}

export async function installApp() {
  const prompt = installPrompt
  if (!prompt) return

  clearInstallPrompt()
  try {
    await prompt.prompt()
  } catch (error) {
    console.warn('Shared: браузер не смог открыть установку.', error)
  }
}

function observeUpdates(registration: ServiceWorkerRegistration) {
  function reportWaitingWorker() {
    const waiting = Boolean(registration.waiting && navigator.serviceWorker.controller)
    if (waiting === updateWaiting) return
    updateWaiting = waiting
    notifyListeners()
  }

  function watchInstallingWorker() {
    registration.installing?.addEventListener('statechange', reportWaitingWorker)
  }

  registration.addEventListener('updatefound', watchInstallingWorker)
  navigator.serviceWorker.addEventListener('controllerchange', reportWaitingWorker)
  watchInstallingWorker()
  reportWaitingWorker()

  let lastCheck = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !navigator.onLine || Date.now() - lastCheck < 60 * 60 * 1000) return
    lastCheck = Date.now()
    void registration.update().catch(() => { /* The browser can retry when the network returns. */ })
  })
}

export function startPwa() {
  if (!import.meta.env.PROD || !window.isSecureContext) return

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    installPrompt = event as InstallPromptEvent
    notifyListeners()
  })
  window.addEventListener('appinstalled', clearInstallPrompt)

  if (!('serviceWorker' in navigator)) return

  function registerWorker() {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(observeUpdates)
      .catch(error => console.warn('Shared: не удалось зарегистрировать service worker.', error))
  }

  if (document.readyState === 'complete') registerWorker()
  else window.addEventListener('load', registerWorker, { once: true })
}
