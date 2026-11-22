import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpRight, Check, Copy, FileText, Maximize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { analyzeNote, formatDateCompact, formatFileSize, type SharedFile, type SharedItem, type SharedNote } from '../types'
import { NoteContentPreview } from './NoteContentPreview'

const palettes = [
  { bg: 'bg-[#FFF1C2] text-[#2D2408]', muted: 'text-[#7D6B28]', action: 'bg-[#2D2408] text-[#FFF1C2]' },
  { bg: 'bg-[#FFE5DE] text-[#36160E]', muted: 'text-[#8C4A3B]', action: 'bg-[#36160E] text-[#FFE5DE]' },
  { bg: 'bg-[#ECE6FF] text-[#211545]', muted: 'text-[#66549E]', action: 'bg-[#211545] text-[#ECE6FF]' },
] as const
const cardMotion = {
  initial: { opacity: 0, scale: 0.94, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
}
const roundAction = 'grid size-9 shrink-0 place-items-center rounded-full transition-colors pointer-coarse:size-11'
const liftCard = 'transition-transform motion-safe:hover:-translate-y-0.5'
const listCard = 'flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-shared-ink/5 sm:gap-3 sm:px-4'
const listSelectionPadding = ' pr-14 sm:pr-14'

function CardDate({ value, className }: { value: string; className: string }) {
  return <time dateTime={value} className={'font-mono text-[11px] ' + className}>{formatDateCompact(value)}</time>
}

function NoteCard({ item, index, compact, onOpen, selection }: {
  item: SharedNote; index: number; compact: boolean; onOpen: (item: SharedNote) => void; selection?: ReactNode
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const info = useMemo(() => analyzeNote(item.text), [item.text])
  const richPreview = info.shape === 'markdown' || info.shape === 'code'
  const compactNote = Array.from(item.text.split('\n', 5).slice(0, 4).join('\n')).slice(0, 280).join('')
  const truncated = compactNote.length < item.text.length
  const text = truncated ? compactNote + '…' : item.text
  const palette = palettes[index % palettes.length]

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = setTimeout(() => setCopyState('idle'), 1600)
    return () => clearTimeout(timer)
  }, [copyState])

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.text)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  const copyButton = (action: string) => (
    <button type="button" onClick={() => void copy()} aria-label="Копировать заметку"
      className={roundAction + ' ' + (copyState === 'copied' ? 'bg-indigo-600 text-white' : action)}>
      {copyState === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  )
  const linkAction = info.shape === 'link' ? (
    <a href={info.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть ссылку"
      className={roundAction + (compact ? ' text-indigo-700 hover:bg-indigo-50' : ' bg-white/80 text-[#0A3F2B] hover:bg-[#0A3F2B] hover:text-white')}>
      <ArrowUpRight className="size-4" />
    </a>
  ) : null
  const noteActions = (action: string) => (
    <div className={'flex shrink-0 items-center gap-1 ' + (selection ? 'invisible' : '')}>
      {linkAction}
      <button type="button" aria-label="Открыть заметку" title="Открыть заметку" onClick={() => onOpen(item)}
        className={roundAction + ' hover:bg-black/10'}>
        <Maximize2 className="size-3.5" />
      </button>
      {copyButton(action)}
    </div>
  )
  const copyFeedback = <>
    <span className="sr-only" role="status">{copyState === 'copied' ? 'Заметка скопирована' : ''}</span>
    {copyState === 'error' ? <p className="text-sm text-shared-error" role="alert">Не удалось скопировать текст.</p> : null}
  </>

  let decoration: string
  let content: ReactNode
  if (compact) {
    decoration = listCard + (selection ? listSelectionPadding : '')
    content = <>
      <div className="min-w-0 flex-1">
        {richPreview ? <NoteContentPreview preview={info} layout="compact" /> : (
          <p className="line-clamp-2 text-sm leading-snug font-bold whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
        )}
        <CardDate value={item.createdAt} className="mt-1 block text-shared-muted" />
        {copyFeedback}
      </div>
      {selection ? null : noteActions('bg-[#F1F3FA] text-shared-ink')}
    </>
  } else if (info.shape === 'link') {
    decoration = 'bg-[#DAF6E8] p-6 text-[#0A3F2B]'
    content = <>
      <span className={'inline-block rounded-full bg-white/70 px-3 py-1 font-mono text-[11.5px] font-bold [overflow-wrap:anywhere] ' + (selection ? 'max-w-[calc(100%-2rem)]' : 'max-w-full')}>
        {info.domain}
      </span>
      <p className="my-5 text-[18px] leading-snug font-extrabold [overflow-wrap:anywhere]">
        {truncated ? text : info.path || info.url}
      </p>
      <div className="flex items-center justify-between gap-2">
        <CardDate value={item.createdAt} className="text-[#276E53]" />
        {noteActions('bg-[#0A3F2B] text-white group-hover:bg-[#155740]')}
      </div>
    </>
  } else if (info.shape === 'color') {
    decoration = 'bg-white p-5 shadow-[0_8px_24px_-12px_rgba(20,22,31,0.08)]'
    content = <>
      <div className="mb-4 h-28 rounded-[22px]" style={{ backgroundColor: info.hexColor }} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15.5px] font-bold [overflow-wrap:anywhere]">{item.text}</p>
          <CardDate value={item.createdAt} className="mt-0.5 text-shared-muted" />
        </div>
        {noteActions('bg-[#F1F3FA] text-shared-ink group-hover:bg-shared-ink group-hover:text-white')}
      </div>
    </>
  } else if (richPreview) {
    decoration = (info.shape === 'markdown' ? 'bg-white ring-1 ring-shared-ink/5' : 'bg-[#EAF0FA]') + ' p-6'
    content = <>
      <div className={selection ? 'pr-8' : undefined}><NoteContentPreview preview={info} layout="card" /></div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <CardDate value={item.createdAt} className="text-shared-muted" />
        {noteActions('bg-white text-shared-ink ring-1 ring-shared-ink/5 hover:bg-indigo-50')}
      </div>
    </>
  } else {
    decoration = 'px-6 pt-[52px] pb-6 ' + palette.bg
    content = <>
      <p className={'my-2 tracking-[-0.02em] whitespace-pre-wrap [overflow-wrap:anywhere] ' + (
        info.shape === 'short' ? 'text-[22px] leading-[1.22] font-extrabold' : 'text-[16px] leading-relaxed font-semibold'
      )}>{text}</p>
      <div className="mt-5 flex items-center justify-between gap-2">
        <CardDate value={item.createdAt} className={palette.muted} />
        {noteActions(palette.action)}
      </div>
    </>
  }

  return (
    <motion.article layout="position" {...cardMotion}
      className={'group relative min-w-0 cursor-pointer ' + (compact ? '' : 'rounded-[30px] ' + liftCard + ' ') + decoration}
      onClick={event => {
        if (selection) return
        if (event.target instanceof Element && event.target.closest('button, a')) return
        if (window.getSelection()?.toString()) return
        void copy()
      }}>
      {content}
      {compact ? null : copyFeedback}
      {selection}
    </motion.article>
  )
}

function FileCard({ item, compact, onPreview, selection }: {
  item: SharedFile; compact: boolean; onPreview: (item: SharedFile) => void; selection?: ReactNode
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>()
  const size = formatFileSize(item.fileSize)
  const downloadLabel = 'Скачать ' + item.fileName
  const previewLabel = 'Открыть ' + item.fileName
  const hideAction = selection ? ' invisible' : ''

  if (compact) {
    const preview = item.textPreviewFormat || (item.imageUrl && failedImageUrl !== item.imageUrl)
    return (
      <motion.article layout="position" {...cardMotion} className={'relative ' + listCard + (selection ? listSelectionPadding : '')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#EAF0FF] text-[#234589]">
          <FileText className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" title={item.fileName}>{item.fileName}</p>
          {item.caption ? <p className="truncate text-xs text-shared-muted">{item.caption}</p> : null}
          <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-shared-muted">
            {size ? <span>{size}</span> : null}
            <time dateTime={item.createdAt}>{formatDateCompact(item.createdAt)}</time>
          </p>
        </div>
        {preview && !selection ? (
          <button type="button" aria-label={previewLabel} onClick={() => onPreview(item)} className={roundAction + ' hover:bg-indigo-50'}>
            <Maximize2 className="size-3.5" />
          </button>
        ) : null}
        {!selection ? (
          <a href={item.downloadUrl} download={item.fileName} aria-label={downloadLabel} className={roundAction + ' bg-[#EAF0FF] text-[#234589] hover:bg-indigo-100'}>
            <ArrowDownToLine className="size-4" />
          </a>
        ) : null}
        {selection}
      </motion.article>
    )
  }

  if (item.fileCategory === 'image' && item.imageUrl && failedImageUrl !== item.imageUrl) {
    return (
      <motion.article layout {...cardMotion} className="group relative overflow-hidden rounded-[30px] bg-shared-ink">
        <div className="relative">
          <button type="button" aria-label={previewLabel} onClick={() => onPreview(item)}
            inert={Boolean(selection)} aria-hidden={selection ? true : undefined}
            className="block h-60 w-full cursor-zoom-in! overflow-hidden focus-visible:-outline-offset-4">
            <img src={item.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedImageUrl(item.imageUrl)}
              className={'size-full object-cover ' + (selection ? '' : 'motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105')} />
          </button>
          <div className="glass-image-controls absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-[22px] bg-white/90 p-2.5 pl-4 backdrop-blur-xl">
            <div className="min-w-0">
              <p title={item.fileName} className="truncate text-[14px] font-bold">{item.fileName}</p>
              {size ? <p className="font-mono text-[11px] text-[#646A80]">{size}</p> : null}
            </div>
            <div className={'flex shrink-0 items-center gap-1.5' + hideAction}>
              <button type="button" onClick={() => onPreview(item)} aria-label={'Развернуть ' + item.fileName}
                className={roundAction + ' bg-[#EEF1F8] text-shared-ink hover:bg-[#DCE2F2]'}>
                <Maximize2 className="size-3.5" />
              </button>
              <a href={item.downloadUrl} download={item.fileName} aria-label={downloadLabel}
                className={roundAction + ' bg-shared-ink text-white hover:bg-indigo-600'}>
                <ArrowDownToLine className="size-4" />
              </a>
            </div>
          </div>
        </div>
        {item.caption ? <p className="bg-white px-5 py-3 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{item.caption}</p> : null}
        {selection}
      </motion.article>
    )
  }

  const FileContent = selection || item.textPreviewFormat ? 'div' : 'a'
  const download = { href: item.downloadUrl, download: item.fileName, 'aria-label': downloadLabel }
  return (
    <motion.article layout {...cardMotion} className={'group relative rounded-[30px] bg-[#DCE8FF] text-[#123278] ' + liftCard}>
      <FileContent {...(FileContent === 'a' ? download : {})} className="relative block overflow-hidden rounded-[inherit] p-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-3 -bottom-5 font-display text-[68px] leading-none font-bold tracking-tighter text-[#123278]/8 uppercase select-none">
          {item.fileExt}
        </span>
        <div className="relative flex min-h-7 items-start">
          {size ? <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11.5px] font-bold">{size}</span> : null}
        </div>
        <p className="relative my-5 text-[21px] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] text-[#102A66]">{item.fileName}</p>
        {item.caption ? <p className="relative -mt-3 mb-4 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{item.caption}</p> : null}
        <div className="relative flex items-center justify-between gap-2">
          <CardDate value={item.createdAt} className="text-[#3E5FA8]" />
          {item.textPreviewFormat && !selection ? (
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" aria-label={previewLabel} onClick={() => onPreview(item)}
                className={roundAction + ' size-10 bg-white/75 text-[#102A66] hover:bg-white'}>
                <Maximize2 className="size-4" />
              </button>
              <a {...download} className={roundAction + ' size-10 bg-[#102A66] text-white hover:bg-indigo-600'}>
                <ArrowDownToLine className="size-4" />
              </a>
            </div>
          ) : (
            <span className={roundAction + ' size-10 bg-[#102A66] text-white group-hover:bg-indigo-600' + hideAction}>
              <ArrowDownToLine className="size-4" />
            </span>
          )}
        </div>
      </FileContent>
      {selection}
    </motion.article>
  )
}

export const WorkspaceCard = memo(function WorkspaceCard({ item, index, compact, onOpenNote, onPreview, selected, onToggleSelection }: {
  item: SharedItem
  index: number
  compact: boolean
  onOpenNote: (item: SharedNote) => void
  onPreview: (item: SharedFile) => void
  selected: boolean
  onToggleSelection?: (item: SharedItem) => void
}) {
  const selection = onToggleSelection ? (
    <label className={'absolute inset-0 z-10 cursor-pointer rounded-[inherit] ' + (selected ? 'ring-2 ring-[oklch(0.88_0_0)] ring-inset' : '')}>
      <input type="checkbox" checked={selected} onChange={() => onToggleSelection(item)} className="peer sr-only"
        aria-label={item.kind === 'file' ? item.fileName : 'Заметка «' + item.text.trim().slice(0, 80) + '»'} />
      <span aria-hidden="true" className={'absolute grid size-7 place-items-center rounded-full border shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-700 '
        + (compact ? 'top-1/2 right-4 -translate-y-1/2 ' : 'top-4 right-4 ')
        + (selected ? 'border-shared-ink bg-[#DED8F7] text-shared-ink' : 'border-[#797487] bg-white')}>
        {selected ? <Check className="size-4" strokeWidth={2.5} /> : null}
      </span>
    </label>
  ) : null
  return item.kind === 'note'
    ? <NoteCard item={item} index={index} compact={compact} onOpen={onOpenNote} selection={selection} />
    : <FileCard item={item} compact={compact} onPreview={onPreview} selection={selection} />
})
