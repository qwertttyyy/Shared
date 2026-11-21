import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { formatDateCompact, type SharedNote } from '../types'

const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-50'

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
  const [text, setText] = useState(note.text)
  const [mode, setMode] = useState<'edit' | 'delete' | 'discard'>('edit')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const changed = text.trim() !== note.text
  const confirming = mode !== 'edit'

  useLayoutEffect(() => {
    const panel = dialog.current
    panel?.showModal()
    return () => panel?.close()
  }, [])

  useLayoutEffect(() => {
    if (confirming) cancelButton.current?.focus()
  }, [confirming])

  function goTo(next: typeof mode) {
    setMode(next)
    setError('')
  }

  function requestClose() {
    if (submitting.current) return
    if (confirming) goTo('edit')
    else if (changed) goTo('discard')
    else onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (mode === 'discard') {
      onClose()
      return
    }
    const draft = text.trim()
    if (mode === 'edit') {
      if (!changed || !draft) return
      if (Array.from(draft).length > 10000) {
        setError('Заметка не должна превышать 10 000 символов.')
        return
      }
    }
    submitting.current = true
    setPending(true)
    setError('')
    try {
      if (mode === 'delete') await onDelete(note.id)
      else await onSave(note.id, draft)
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
            <h2 id={titleId} className="text-lg font-extrabold">{mode === 'delete' ? 'Удалить заметку?' : mode === 'discard' ? 'Закрыть без сохранения?' : 'Заметка'}</h2>
            {!confirming ? <time dateTime={note.createdAt} className="mt-0.5 block font-mono text-xs text-shared-muted">{formatDateCompact(note.createdAt)}</time> : null}
          </div>
          <button type="button" aria-label="Закрыть" onClick={requestClose} disabled={pending}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F1F3FA] text-shared-muted enabled:hover:bg-indigo-100">
            <X className="size-5" />
          </button>
        </header>
        {confirming ? (
          <p className="px-1 text-sm leading-relaxed text-shared-muted">
            {mode === 'delete' ? 'Заметка исчезнет из ленты на всех ваших устройствах.' : 'Изменения в этой заметке будут потеряны.'}
          </p>
        ) : (
          <textarea aria-label="Текст заметки" value={text} onChange={event => { setText(event.target.value); setError('') }}
            readOnly={pending} maxLength={20000}
            className="thin-scrollbar block min-h-32 max-h-[50dvh] w-full resize-y rounded-2xl bg-[#F6F7FB] p-3 text-base leading-relaxed sm:p-4" rows={7} />
        )}
        {error ? <p role="alert" className="px-1 text-sm text-shared-error">{error}</p> : null}
        <footer className={'flex flex-wrap items-center gap-2 ' + (confirming ? 'justify-end' : 'justify-between')}>
          {confirming ? (
            <button ref={cancelButton} type="button" onClick={() => goTo('edit')} disabled={pending} className={actionClass + ' bg-[#F1F3FA] enabled:hover:bg-indigo-100'}>
              Отмена
            </button>
          ) : (
            <button type="button" onClick={() => goTo('delete')} disabled={pending} className={actionClass + ' text-shared-error enabled:hover:bg-red-50'}>
              <Trash2 className="size-4" /> Удалить
            </button>
          )}
          <button type="submit" disabled={pending || (!confirming && (!changed || !text.trim()))}
            className={actionClass + (mode === 'delete' ? ' bg-shared-error text-white enabled:hover:bg-red-900' : ' bg-shared-ink text-white enabled:hover:bg-indigo-700')}>
            {mode === 'delete' ? (pending ? 'Удаляем…' : 'Удалить') : mode === 'discard' ? 'Закрыть' : (pending ? 'Сохраняем…' : 'Сохранить')}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
