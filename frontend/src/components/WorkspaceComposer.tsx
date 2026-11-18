import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Paperclip, Plus, X } from 'lucide-react'
import { motion } from 'motion/react'

type Attachment = { id: number; file: File }
export type SaveDraft = {
  text: string
  attachments: Attachment[]
  onUploaded: (id: number) => void
}

type WorkspaceComposerProps = {
  onSave: (draft: SaveDraft) => Promise<void>
  saving: boolean
  disabled: boolean
  previewOpen: boolean
}

const fileLimit = 25 * 1024 * 1024
const noteLimit = 10000
const captionLimit = 500

export function WorkspaceComposer({ onSave, saving, disabled, previewOpen }: WorkspaceComposerProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const noteButton = useRef<HTMLButtonElement>(null)
  const attachmentId = useRef(0)
  const restoreFocus = useRef(false)
  const submitting = useRef(false)
  const errorId = useId()
  const locked = saving || disabled
  const canSave = Boolean(text.trim() || attachments.length)
  const expanded = open || canSave
  const fieldLabel = attachments.length ? 'Подпись к файлу' : 'Заметка'
  const placeholder = attachments.length > 1 ? 'Подпись ко всем файлам' : fieldLabel

  const attachFiles = useCallback((files: FileList) => {
    if (!files.length || locked || submitting.current) return
    const accepted: Attachment[] = []
    let rejected = ''
    for (const file of files) {
      if (!file.size) {
        rejected ||= 'Файл «' + file.name + '» пуст.'
      } else if (file.size > fileLimit) {
        rejected ||= 'Файл «' + file.name + '» превышает 25 МБ.'
      } else {
        accepted.push({ id: attachmentId.current++, file })
      }
    }
    setOpen(true)
    setError(rejected)
    if (accepted.length) setAttachments(current => [...current, ...accepted])
  }, [locked])

  useEffect(() => {
    let dragDepth = 0
    const containsFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files')

    function enter(event: DragEvent) {
      if (!containsFiles(event)) return
      event.preventDefault()
      if (locked || previewOpen) return
      dragDepth += 1
      setDragging(true)
    }
    function leave(event: DragEvent) {
      if (!containsFiles(event)) return
      dragDepth = Math.max(0, dragDepth - 1)
      if (!dragDepth) setDragging(false)
    }
    function over(event: DragEvent) {
      if (!containsFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = locked || previewOpen ? 'none' : 'copy'
    }
    function drop(event: DragEvent) {
      if (!event.dataTransfer?.files.length) return
      event.preventDefault()
      dragDepth = 0
      setDragging(false)
      if (!previewOpen) attachFiles(event.dataTransfer.files)
    }
    function paste(event: ClipboardEvent) {
      if (locked || previewOpen || !event.clipboardData?.files.length) return
      event.preventDefault()
      attachFiles(event.clipboardData.files)
    }
    function resetDrag() {
      dragDepth = 0
      setDragging(false)
    }

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    window.addEventListener('paste', paste)
    window.addEventListener('blur', resetDrag)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
      window.removeEventListener('paste', paste)
      window.removeEventListener('blur', resetDrag)
    }
  }, [attachFiles, locked, previewOpen])

  useEffect(() => {
    if (!expanded && restoreFocus.current) {
      restoreFocus.current = false
      noteButton.current?.focus()
    }
  }, [expanded])

  function closeComposer() {
    restoreFocus.current = true
    setError('')
    setOpen(false)
  }

  function removeAttachment(id: number) {
    setAttachments(current => current.filter(file => file.id !== id))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked || submitting.current || !canSave) return
    const draft = text.trim()
    const limit = attachments.length ? captionLimit : noteLimit
    if ([...draft].length > limit) {
      setError(attachments.length ? 'Подпись не должна превышать 500 символов.' : 'Заметка не должна превышать 10 000 символов.')
      return
    }

    setError('')
    submitting.current = true
    try {
      await onSave({ text: draft, attachments, onUploaded: removeAttachment })
      setText('')
      closeComposer()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить запись.')
    } finally {
      submitting.current = false
    }
  }

  return (
    <motion.section layout className="mb-9 rounded-[30px] bg-white p-2.5 shadow-[0_14px_40px_-14px_rgba(20,22,31,0.09)] ring-1 ring-shared-ink/5 md:p-3"
      aria-label="Добавить запись">
      <input ref={fileInput} type="file" hidden multiple onChange={event => {
        if (event.target.files) attachFiles(event.target.files)
        event.target.value = ''
      }} />

      {dragging && !locked && !previewOpen ? createPortal(
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-shared-bg/80 backdrop-blur-md">
          <span className="grid size-28 place-items-center rounded-full border-2 border-dashed border-indigo-500/60 bg-white text-indigo-600 shadow-2xl">
            <Paperclip className="size-9 motion-safe:animate-bounce" />
          </span>
        </div>,
        document.body,
      ) : null}

      {!expanded ? (
        <div className="flex items-center gap-2">
          <button ref={noteButton} type="button" disabled={locked} onClick={() => setOpen(true)}
            className="flex flex-1 items-center gap-3 rounded-full px-3.5 py-2 text-left text-[15.5px] font-medium text-[#6B7188] transition-colors enabled:hover:text-shared-ink">
            <span className="grid size-8 place-items-center rounded-full bg-[#F1F3FA] text-shared-ink">
              <Plus className="size-4" />
            </span>
            Заметка
          </button>
          <button type="button" disabled={locked} onClick={() => fileInput.current?.click()} aria-label="Прикрепить файл"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#F1F3FA] px-4 text-[13px] font-semibold transition-colors enabled:hover:bg-[#E4E8F5]">
            <Paperclip className="size-4 text-indigo-600" />
            <span className="hidden sm:inline">Прикрепить файл</span>
          </button>
        </div>
      ) : (
        <form className="p-1.5" onSubmit={submit} aria-busy={saving}>
          <textarea autoFocus value={text} rows={3} maxLength={noteLimit * 2} readOnly={locked}
            aria-label={placeholder} aria-describedby={error ? errorId : undefined}
            placeholder={placeholder} onChange={event => {
              setText(event.target.value)
              setError('')
            }} onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            className="w-full resize-y rounded-xl bg-transparent px-2 py-1 text-[16.5px] leading-relaxed placeholder:text-[#6B7188]" />

          {attachments.length ? (
            <ul className="mt-1 mb-2 flex flex-wrap gap-2 px-2" aria-label="Прикреплённые файлы">
              {attachments.map(({ id, file }) => (
                <li key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#DCE8FF] pl-3 text-[12.5px] font-semibold text-[#153E90]">
                  <span className="max-w-[180px] truncate" title={file.name}>{file.name}</span>
                  <button type="button" disabled={locked} onClick={() => { removeAttachment(id); setError('') }}
                    aria-label={'Убрать файл ' + file.name} className="grid size-9 shrink-0 place-items-center rounded-full enabled:hover:bg-black/10">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {error ? <p id={errorId} className="px-2 pt-1 text-sm break-words text-shared-error" role="alert">{error}</p> : null}
          <div className="mt-2 flex items-center justify-between gap-2 pt-2">
            <button type="button" disabled={locked} onClick={() => fileInput.current?.click()} aria-label="Прикрепить файл"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#F3F5FB] px-4 text-[13.5px] font-semibold whitespace-nowrap text-[#3C4157] transition-colors enabled:hover:bg-[#E7EBF7]">
              <Paperclip className="size-4 text-indigo-600" />
              <span className="sm:hidden">Файл</span>
              <span className="hidden sm:inline">Прикрепить файл</span>
            </button>
            <div className="flex items-center gap-2">
              {!canSave ? (
                <button type="button" disabled={locked} onClick={closeComposer} aria-label="Свернуть"
                  className="grid size-11 place-items-center rounded-full text-shared-muted enabled:hover:bg-[#F3F5FB]">
                  <X className="size-4" />
                </button>
              ) : null}
              <button type="submit" disabled={!canSave || locked}
                className="min-h-11 rounded-full bg-shared-ink px-4 text-[13.5px] font-bold text-white transition-colors enabled:hover:bg-indigo-600 disabled:bg-[#EEF0F7] disabled:text-shared-muted sm:px-5">
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      )}
    </motion.section>
  )
}
