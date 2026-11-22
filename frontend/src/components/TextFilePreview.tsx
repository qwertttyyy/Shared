import { ArrowDownToLine, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { SourceLanguage, TextPreviewFormat } from '../textPreviewFormats'
import { formatFileSize, type SharedFile } from '../types'
import { HighlightedText } from './HighlightedText'
import { MarkdownContent } from './MarkdownContent'

const control = 'grid size-11 shrink-0 place-items-center rounded-full bg-[#EEF1F8] text-shared-ink hover:bg-[#DCE2F2]'
const viewButton = 'min-h-9 rounded-full px-3 text-[13px] font-bold text-shared-muted aria-pressed:bg-white aria-pressed:text-shared-ink pointer-coarse:min-h-11'
const statusClass = 'px-5 py-8 text-sm text-shared-muted sm:px-7'

type PreviewData = { text: string } | { error: string }

function PlainText({ text }: { text: string }) {
  return <pre dir="auto" className="p-5 font-mono text-[13px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] sm:p-7">{text}</pre>
}

function SourcePreview({ text, language }: { text: string; language: SourceLanguage }) {
  const source = useMemo(() => text.replace(/\r\n?/g, '\n'), [text])
  const lineCount = useMemo(() => source.split('\n').length, [source])
  const lineNumbers = useMemo(() => lineCount <= 10_000
    ? Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')
    : '', [lineCount])

  return <div dir="ltr" className="flex w-max min-w-full bg-[#F8F9FD] font-mono text-[13px] leading-6">
    {lineNumbers ? (
      <pre aria-hidden="true" className="sticky left-0 shrink-0 border-r border-[#E1E7F4] bg-[#EDF1FA] px-3 py-5 text-right text-[#5C6580] select-none sm:px-4">{lineNumbers}</pre>
    ) : null}
    <pre className="px-4 py-5 [tab-size:4] sm:px-6"><code><HighlightedText text={source} language={language} /></code></pre>
  </div>
}

export function TextFilePreview({ item, format, onClose }: {
  item: SharedFile
  format: TextPreviewFormat
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [data, setData] = useState<PreviewData>()
  const [showSource, setShowSource] = useState(false)
  const markdown = format === 'markdown'
  const size = formatFileSize(item.fileSize)

  useLayoutEffect(() => {
    const panel = dialog.current
    panel?.showModal()
    closeButton.current?.focus()
    return () => panel?.close()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void api.textPreview(item.id, controller.signal).then(preview => {
      if (!controller.signal.aborted) setData(preview)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setData({ error: error instanceof Error ? error.message : 'Не удалось открыть файл.' })
    })
    return () => controller.abort()
  }, [item.id])

  let content
  if (!data) content = <p role="status" className={statusClass}>Открываем файл…</p>
  else if ('error' in data) content = <p role="alert" className={statusClass}>{data.error}</p>
  else if (!data.text) content = <p className={statusClass}>Файл пуст.</p>
  else if (markdown && !showSource) content = <MarkdownContent text={data.text} fallback={<PlainText text={data.text} />} />
  else if (format === 'text' || markdown) content = <PlainText text={data.text} />
  else content = <SourcePreview text={data.text} language={format} />

  return <dialog ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    className="text-file-preview fixed inset-0 m-auto max-h-none w-[calc(100%-1rem)] max-w-4xl overflow-hidden rounded-[26px] bg-white text-shared-ink shadow-2xl sm:w-[calc(100%-3rem)]">
    <div className="flex max-h-[calc(100dvh-1rem)] min-h-[min(24rem,85dvh)] flex-col sm:max-h-[calc(100dvh-4rem)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[#E1E7F4] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} title={item.fileName} className="truncate text-base font-extrabold tracking-tight sm:text-lg">{item.fileName}</h2>
          {size ? <p className="font-mono text-xs text-shared-muted">{size}</p> : null}
        </div>
        {markdown ? <div aria-label="Вид Markdown" role="group" className="order-last w-full sm:order-none sm:w-auto sm:shrink-0">
          <div className="inline-flex gap-1 rounded-full bg-[#EEF1F8] p-1">
            <button type="button" aria-pressed={!showSource} className={viewButton} onClick={() => setShowSource(false)}>Просмотр</button>
            <button type="button" aria-pressed={showSource} className={viewButton} onClick={() => setShowSource(true)}>Исходник</button>
          </div>
        </div> : null}
        <div className="flex shrink-0 gap-2">
          <a href={item.downloadUrl} download={item.fileName} aria-label="Скачать" className={control}>
            <ArrowDownToLine className="size-4.5" />
          </a>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Закрыть" className={control}>
            <X className="size-5" />
          </button>
        </div>
      </header>
      <section key={String(showSource)} tabIndex={0} aria-label="Содержимое файла"
        className="thin-scrollbar min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:-outline-offset-2">{content}</section>
    </div>
  </dialog>
}
