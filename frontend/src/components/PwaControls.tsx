import { useSyncExternalStore } from 'react'
import { canInstallApp, hasAppUpdate, installApp, subscribeToPwa } from '../pwa'

export function InstallAppButton({ className }: { className: string }) {
  const available = useSyncExternalStore(subscribeToPwa, canInstallApp)
  if (!available) return null

  return (
    <button className={className} type="button" onClick={() => void installApp()}>
      Установить <span className="sr-only">Shared</span>
    </button>
  )
}

export function AppUpdateNotice() {
  const waiting = useSyncExternalStore(subscribeToPwa, hasAppUpdate)
  if (!waiting) return null

  return (
    <p className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-2xl bg-shared-ink px-4 py-3 text-sm text-white shadow-lg" role="status">
      Доступна новая версия. Она установится после закрытия всех окон и вкладок Shared.
    </p>
  )
}
