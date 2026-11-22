import { useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { analyzeNote, formatDateCompact, type AnalyzedNote, type SharedNote } from '../types'
import { NoteContentPreview } from './NoteContentPreview'

const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-50'
const viewButton = 'min-h-9 rounded-full px-3 text-[13px] font-bold text-shared-muted aria-pressed:bg-white aria-pressed:text-shared-ink disabled:opacity-60 pointer-coarse:min-h-11 sm:px-4'

function OpenNotePreview({ text, preview }: { text: string; preview: AnalyzedNote }) {
  if (preview.shape === 'markdown' || preview.shape === 'code') return <NoteContentPreview preview={preview} layout="full" />

  return <div className="space-y-3 p-4 sm:p-6">
    {preview.shape === 'color' ? <div aria-hidden="true" className="h-24 rounded-xl" style={{ backgroundColor: preview.hexColor }} /> : null}
    <p dir="auto" className="text-base leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
      {preview.shape === 'link' ? <a href={preview.url} target="_blank" rel="noreferrer" className="text-indigo-700 underline underline-offset-3">{text}</a> : text}
    </p>
  </div>
}

export function NoteEditor({ note, onSave, onDelete, onClose }: {
  note: SharedNote
  onSave: (id: string, text: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const titleId = useId()
  const originalFormat = useMemo(() => analyzeNote(note.text), [note.text])
  const [text, setText] = useState(note.text)
  const [view, setView] = useState<'preview' | 'source'>(() =>
    originalFormat.shape === 'markdown' || originalFormat.shape === 'code' ? 'preview' : 'source')
  const [confirmation, setConfirmation] = useState<'delete' | 'discard' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const changed = text !== note.text
  const preview = useMemo(() => {
    if (view !== 'preview' || confirmation) return null
    return changed ? analyzeNote(text) : originalFormat
  }, [changed, confirmation, originalFormat, text, view])

  useLayoutEffect(() => {
    const panel = dialog.current
    panel?.showModal()
    return () => panel?.close()
  }, [])

  useLayoutEffect(() => {
    if (confirmation) cancelButton.current?.focus()
  }, [confirmation])

  function confirm(next: typeof confirmation) {
    setConfirmation(next)
    setError('')
  }

  function requestClose() {
    if (submitting.current) return
    if (confirmation) confirm(null)
    else if (changed) confirm('discard')
    else onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (confirmation === 'discard') {
      onClose()
      return
    }
    if (!confirmation) {
      if (!changed || !text.trim()) return
      if (Array.from(text).length > 10000) {
        setError('Заметка не должна превышать 10 000 символов.')
        return
      }
    }
    submitting.current = true
    setPending(true)
    setError('')
    try {
      if (confirmation === 'delete') await onDelete(note.id)
      else await onSave(note.id, text)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Попробуйте ещё раз.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      className="note-editor fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[26px] bg-white p-0 text-shared-ink shadow-2xl"
      onCancel={event => { event.preventDefault(); requestClose() }}>
      <form onSubmit={submit} className="space-y-4 p-4 sm:p-6" aria-busy={pending}>
        <header className="flex items-start justify-between gap-3">
          <div className="pl-1 pt-1">
            <h2 id={titleId} className="text-lg font-extrabold">{confirmation === 'delete' ? 'Удалить заметку?' : confirmation === 'discard' ? 'Закрыть без сохранения?' : 'Заметка'}</h2>
            {!confirmation ? <time dateTime={note.createdAt} className="mt-0.5 block font-mono text-xs text-shared-muted">{formatDateCompact(note.createdAt)}</time> : null}
          </div>
          <button type="button" aria-label="Закрыть" onClick={requestClose} disabled={pending}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F1F3FA] text-shared-muted enabled:hover:bg-indigo-100">
            <X className="size-5" />
          </button>
        </header>
        {confirmation ? (
          <p className="px-1 text-sm leading-relaxed text-shared-muted">
            {confirmation === 'delete' ? 'Заметка исчезнет из ленты на всех ваших устройствах.' : 'Изменения в этой заметке будут потеряны.'}
          </p>
        ) : <div className="space-y-3">
          <div role="group" aria-label="Режим заметки" className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-[#EEF1F8] p-1">
            <button type="button" aria-pressed={view === 'preview'} disabled={pending} onClick={() => setView('preview')} className={viewButton}>Просмотр</button>
            <button type="button" aria-pressed={view === 'source'} disabled={pending} onClick={() => setView('source')} className={viewButton}>Редактировать</button>
          </div>
          {preview ? (
            <section tabIndex={0} aria-label="Содержимое заметки"
              className="thin-scrollbar max-h-[55dvh] min-w-0 overflow-auto overscroll-contain rounded-2xl bg-[#F6F7FB] focus-visible:-outline-offset-2">
              <OpenNotePreview text={text} preview={preview} />
            </section>
          ) : (
            <textarea aria-label="Текст заметки" value={text} onChange={event => { setText(event.target.value); setError('') }}
              readOnly={pending} maxLength={20000}
              className={'thin-scrollbar block min-h-32 max-h-[50dvh] w-full resize-y rounded-2xl bg-[#F6F7FB] p-3 text-base leading-relaxed sm:p-4'
                + (originalFormat.shape === 'code' ? ' font-mono [tab-size:4]' : '')} rows={7} />
          )}
        </div>}
        {error ? <p role="alert" className="px-1 text-sm text-shared-error">{error}</p> : null}
        <footer className={'flex flex-wrap items-center gap-2 ' + (confirmation ? 'justify-end' : 'justify-between')}>
          {confirmation ? (
            <button ref={cancelButton} type="button" onClick={() => confirm(null)} disabled={pending} className={actionClass + ' bg-[#F1F3FA] enabled:hover:bg-indigo-100'}>
              Отмена
            </button>
          ) : (
            <button type="button" onClick={() => confirm('delete')} disabled={pending} className={actionClass + ' text-shared-error enabled:hover:bg-red-50'}>
              <Trash2 className="size-4" /> Удалить
            </button>
          )}
          {confirmation || view === 'source' || changed ? (
            <button type="submit" disabled={pending || (!confirmation && (!changed || !text.trim()))}
              className={actionClass + (confirmation === 'delete' ? ' bg-shared-error text-white enabled:hover:bg-red-900' : ' bg-shared-ink text-white enabled:hover:bg-indigo-700')}>
              {confirmation === 'delete' ? (pending ? 'Удаляем…' : 'Удалить') : confirmation === 'discard' ? 'Закрыть' : (pending ? 'Сохраняем…' : 'Сохранить')}
            </button>
          ) : null}
        </footer>
      </form>
    </dialog>
  )
}
