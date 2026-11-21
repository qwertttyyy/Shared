import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { CircleCheck, Grid2X2, List, LogOut, Trash2 } from 'lucide-react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import type { SharedFile, SharedItem, SharedNote } from '../types'
import { AppTitle } from './AppTitle'
import { DeleteSelectionDialog } from './DeleteSelectionDialog'
import { ImageLightbox } from './ImageLightbox'
import { NoteEditor } from './NoteEditor'
import { InstallAppButton } from './PwaControls'
import { WorkspaceCard } from './WorkspaceCard'
import { WorkspaceComposer, composerLayoutTransition, type SaveDraft } from './WorkspaceComposer'

type SharedWorkspaceProps = {
  items: SharedItem[]
  online: boolean
  loading: boolean
  saving: boolean
  onSave: (draft: SaveDraft) => Promise<void>
  onUpdateNote: (id: string, text: string) => Promise<unknown>
  onDeleteNote: (id: string) => Promise<unknown>
  onDeleteItems: (ids: string[]) => Promise<void>
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
const viewPreference = 'shared.entry-view'

function prefersList() {
  try {
    return localStorage.getItem(viewPreference) === 'list'
  } catch {
    return false
  }
}

export default function SharedWorkspace({ items, online, loading, saving, onSave, onUpdateNote, onDeleteNote, onDeleteItems, onLogout, loggingOut, logoutError, children }: SharedWorkspaceProps) {
  const [preview, setPreview] = useState<SharedFile | null>(null)
  const [selectedNote, setSelectedNote] = useState<SharedNote | null>(null)
  const [listView, setListView] = useState(prefersList)
  const [selection, setSelection] = useState<Map<string, SharedItem> | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const entriesHeading = useRef<HTMLHeadingElement>(null)
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop)

  function toggleView() {
    const next = !listView
    setListView(next)
    try {
      localStorage.setItem(viewPreference, next ? 'list' : 'tiles')
    } catch { /* The current view still works when storage is unavailable. */ }
  }

  const toggleSelectedItem = useCallback((item: SharedItem) => {
    setSelection(current => {
      if (!current) return current
      const next = new Map(current)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item)
      return next
    })
  }, [])

  function finishSelection() {
    setConfirmingDelete(false)
    setSelection(null)
    requestAnimationFrame(() => entriesHeading.current?.focus({ preventScroll: true }))
  }

  function renderCards(column?: 0 | 1) {
    return items.map((item, index) => (
      column === undefined || index % 2 === column
        ? <WorkspaceCard key={item.id} item={item} index={index} compact={listView} onOpenNote={setSelectedNote} onPreview={setPreview}
            selected={selection?.has(item.id) ?? false} onToggleSelection={selection ? toggleSelectedItem : undefined} />
        : null
    ))
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className={'mx-auto min-h-dvh w-full max-w-[900px] px-4 pt-6 selection:bg-indigo-500/20 md:px-8 md:pt-10 ' + (selection ? 'pb-28' : 'pb-16')}
        onKeyDown={event => {
          if (event.key === 'Escape' && selection && !event.defaultPrevented) finishSelection()
        }}>
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
        <LayoutGroup>
          <WorkspaceComposer onSave={onSave} saving={saving} disabled={loggingOut} previewOpen={Boolean(preview || selectedNote)} />

          <motion.section layout="position" transition={composerLayoutTransition} aria-label="Записи" aria-busy={loading}>
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <h2 ref={entriesHeading} tabIndex={-1} className="text-sm font-extrabold text-shared-ink">Записи</h2>
              <div className="flex items-center gap-2">
                <button type="button" disabled={!selection && !items.length}
                  onClick={() => selection ? setSelection(null) : setSelection(new Map())}
                  className={headerButton + (selection ? ' bg-[#DED8F7]! text-shared-ink hover:bg-[#D2C8F3]!' : ' hover:bg-[#F0EDFA]')}>
                  {!selection ? <CircleCheck className="size-4" /> : null}
                  {selection ? 'Отмена' : 'Выбрать'}
                </button>
                <button type="button" onClick={toggleView}
                  aria-label={listView ? 'Показать плитки' : 'Показать список'}
                  className={headerButton + ' hover:bg-[#F0EDFA]'}>
                  {listView ? <Grid2X2 className="size-4" /> : <List className="size-4" />}
                  {listView ? 'Плитки' : 'Список'}
                </button>
              </div>
            </div>
            {desktop && !listView ? (
              <div className="grid grid-cols-2 items-start gap-4">
                <motion.div layout className="flex min-w-0 flex-col gap-4">
                  {renderCards(0)}
                </motion.div>
                <motion.div layout className="flex min-w-0 flex-col gap-4 pt-7">
                  {renderCards(1)}
                </motion.div>
              </div>
            ) : (
              <motion.div layout="position" className={'flex min-w-0 flex-col ' + (listView ? 'gap-2' : 'gap-4')}>
                {renderCards()}
              </motion.div>
            )}
            {children}
          </motion.section>
        </LayoutGroup>
        {selection ? (
          <div role="group" aria-label="Выбранные записи"
            className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center justify-between gap-2 rounded-[24px] bg-white p-2 pl-4 shadow-[0_12px_32px_rgba(20,22,31,0.16)] ring-1 ring-shared-ink/8">
            <span role="status" className="text-sm font-bold text-shared-ink">Выбрано {selection.size}</span>
            <button type="button" disabled={!selection.size || !online || loggingOut} onClick={() => setConfirmingDelete(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-shared-error px-4 text-sm font-bold text-white enabled:hover:bg-red-900 disabled:bg-[#F1F3FA] disabled:text-shared-muted">
              <Trash2 className="size-4" /> Удалить
            </button>
          </div>
        ) : null}
      </main>
      {confirmingDelete && selection ? (
        <DeleteSelectionDialog selection={selection} online={online} onDelete={onDeleteItems}
          onDismiss={() => setConfirmingDelete(false)} onDeleted={finishSelection} />
      ) : null}
      {selectedNote ? (
        <NoteEditor key={selectedNote.id} note={selectedNote} onSave={onUpdateNote} onDelete={onDeleteNote} onClose={() => setSelectedNote(null)} />
      ) : null}
      <AnimatePresence>
        {preview?.imageUrl ? (
          <ImageLightbox key={preview.id} item={preview} imageUrl={preview.imageUrl} onClose={() => setPreview(null)} />
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  )
}
