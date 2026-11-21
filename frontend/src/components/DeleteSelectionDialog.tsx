import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import type { SharedItem } from '../types'

const actionClass = 'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold disabled:opacity-50'

export function DeleteSelectionDialog({ selection, online, onDelete, onDismiss, onDeleted }: {
  selection: ReadonlyMap<string, SharedItem>
  online: boolean
  onDelete: (ids: string[]) => Promise<void>
  onDismiss: () => void
  onDeleted: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const singleItem = selection.size === 1 ? selection.values().next().value : undefined
  const file = singleItem?.kind === 'file' ? singleItem : undefined

  useLayoutEffect(() => {
    const panel = dialog.current
    panel?.showModal()
    cancelButton.current?.focus()
    return () => panel?.close()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !online) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      await onDelete([...selection.keys()])
      onDeleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить выбранные записи. Попробуйте ещё раз.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      className="delete-selection fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[26px] bg-white p-0 text-shared-ink shadow-2xl"
      onCancel={event => { event.preventDefault(); if (!submitting.current) onDismiss() }}>
      <form onSubmit={submit} className="space-y-4 p-5 sm:p-6" aria-busy={pending}>
        <h2 id={titleId} className="text-lg font-extrabold">
          {file ? 'Удалить файл?' : singleItem ? 'Удалить заметку?' : 'Удалить выбранные записи?'}
        </h2>
        <p id={descriptionId} className="text-sm leading-relaxed text-shared-muted">
          {file ? <strong className="mb-1 block text-shared-ink [overflow-wrap:anywhere]">{file.fileName}</strong> : null}
          {singleItem ? 'Запись исчезнет из ленты на всех ваших устройствах.' : `Выбрано ${selection.size}. Записи исчезнут из ленты на всех ваших устройствах.`}
        </p>
        {error ? <p role="alert" className="text-sm text-shared-error">{error}</p> : null}
        {!online && !error ? <p role="status" className="text-sm text-shared-muted">Подключитесь к интернету, чтобы удалить записи.</p> : null}
        <footer className="flex flex-wrap justify-end gap-2">
          <button ref={cancelButton} type="button" disabled={pending} onClick={onDismiss}
            className={actionClass + ' bg-[#F1F3FA] enabled:hover:bg-indigo-100'}>Отмена</button>
          <button type="submit" disabled={pending || !online}
            className={actionClass + ' bg-shared-error text-white enabled:hover:bg-red-900'}>{pending ? 'Удаляем…' : 'Удалить'}</button>
        </footer>
      </form>
    </dialog>
  )
}
