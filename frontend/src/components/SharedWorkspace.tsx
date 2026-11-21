import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import type { SharedFile, SharedItem } from '../types'
import { AppTitle } from './AppTitle'
import { ImageLightbox } from './ImageLightbox'
import { InstallAppButton } from './PwaControls'
import { WorkspaceCard } from './WorkspaceCard'
import { WorkspaceComposer, type SaveDraft } from './WorkspaceComposer'

type SharedWorkspaceProps = {
  items: SharedItem[]
  online: boolean
  loading: boolean
  saving: boolean
  onSave: (draft: SaveDraft) => Promise<void>
  onLogout: () => void
  loggingOut: boolean
  logoutError?: string
  children?: ReactNode
}

const desktopQuery = '(min-width: 48rem)'
const isDesktop = () => window.matchMedia(desktopQuery).matches

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(desktopQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const headerButton = 'inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-shared-muted shadow-[0_4px_16px_rgba(20,22,31,0.05)] transition-colors enabled:hover:text-shared-ink disabled:opacity-60 pointer-coarse:min-h-11'

export default function SharedWorkspace({ items, online, loading, saving, onSave, onLogout, loggingOut, logoutError, children }: SharedWorkspaceProps) {
  const [preview, setPreview] = useState<SharedFile | null>(null)
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop)

  function renderCards(column?: 0 | 1) {
    return items.map((item, index) => (
      column === undefined || index % 2 === column
        ? <WorkspaceCard key={item.id} item={item} index={index} onPreview={setPreview} />
        : null
    ))
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto min-h-dvh w-full max-w-[900px] px-4 pt-6 pb-16 selection:bg-indigo-500/20 md:px-8 md:pt-10">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <AppTitle className="text-[21px]" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <InstallAppButton className={headerButton} />
            <button type="button" disabled={loggingOut || saving} onClick={onLogout} className={headerButton}>
              {loggingOut ? 'Выходим…' : 'Выйти'}
              <LogOut className="size-3.5" />
            </button>
          </div>
        </header>
        {!online ? (
          <p className="mb-3 text-sm text-shared-muted" role="status">
            Нет подключения к интернету. Синхронизация возобновится после подключения.
          </p>
        ) : null}
        {logoutError ? <p className="mb-3 text-sm text-shared-error" role="alert">{logoutError}</p> : null}
        <WorkspaceComposer onSave={onSave} saving={saving} disabled={loggingOut} previewOpen={Boolean(preview)} />

        <section aria-label="Записи" aria-busy={loading}>
          {desktop ? (
            <div className="grid grid-cols-2 items-start gap-4">
              <motion.div layout className="flex min-w-0 flex-col gap-4">
                {renderCards(0)}
              </motion.div>
              <motion.div layout className="flex min-w-0 flex-col gap-4 pt-7">
                {renderCards(1)}
              </motion.div>
            </div>
          ) : (
            <motion.div layout className="flex flex-col gap-4">
              {renderCards()}
            </motion.div>
          )}
          {children}
        </section>
      </main>
      <AnimatePresence>
        {preview?.imageUrl ? (
          <ImageLightbox key={preview.id} item={preview} imageUrl={preview.imageUrl} onClose={() => setPreview(null)} />
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  )
}
