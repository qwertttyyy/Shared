import { memo, useEffect, useId, useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpRight, Check, Copy, Maximize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { analyzeNote, formatDateCompact, formatFileSize, type SharedFile, type SharedItem, type SharedNote } from '../types'

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

function CardDate({ value, className }: { value: string; className: string }) {
  return <time dateTime={value} className={'font-mono text-[11px] ' + className}>{formatDateCompact(value)}</time>
}

function NoteCard({ item, index }: { item: SharedNote; index: number }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const info = analyzeNote(item.text)
  const compactNote = Array.from(item.text.split('\n', 5).slice(0, 4).join('\n')).slice(0, 280).join('')
  const truncated = compactNote.length < item.text.length
  const text = truncated && !expanded ? compactNote + '…' : item.text
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
  const expandButton = truncated ? (
    <button type="button" aria-controls={textId} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
      className="min-h-9 rounded-sm text-sm font-semibold underline underline-offset-3">
      {expanded ? 'Свернуть' : 'Читать полностью'}
    </button>
  ) : null

  let decoration: string
  let content: ReactNode
  if (info.shape === 'link') {
    decoration = 'bg-[#DAF6E8] p-6 text-[#0A3F2B]'
    content = <>
      <span className="inline-block max-w-full rounded-full bg-white/70 px-3 py-1 font-mono text-[11.5px] font-bold [overflow-wrap:anywhere]">
        {info.domain}
      </span>
      <p id={textId} className="my-5 text-[18px] leading-snug font-extrabold [overflow-wrap:anywhere]">
        {!expanded && truncated ? text : info.path || info.url}
      </p>
      {expandButton}
      <div className="flex items-center justify-between gap-2">
        <CardDate value={item.createdAt} className="text-[#276E53]" />
        <div className="flex items-center gap-1.5">
          <a href={info.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть ссылку"
            className={roundAction + ' bg-white/80 text-[#0A3F2B] hover:bg-[#0A3F2B] hover:text-white'}>
            <ArrowUpRight className="size-4" />
          </a>
          {copyButton('bg-[#0A3F2B] text-white group-hover:bg-[#155740]')}
        </div>
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
        {copyButton('bg-[#F1F3FA] text-shared-ink group-hover:bg-shared-ink group-hover:text-white')}
      </div>
    </>
  } else if (info.shape === 'code') {
    decoration = 'bg-[#102128] p-6 text-[#A7F3D0]'
    content = <>
      <pre id={textId} className="thin-scrollbar my-2 overflow-x-auto pr-6 font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</pre>
      {expandButton}
      <div className="mt-5 flex items-center justify-between gap-2">
        <CardDate value={item.createdAt} className="text-[#83C7AF]" />
        {copyButton('bg-white/10 text-white group-hover:bg-white/20')}
      </div>
    </>
  } else {
    decoration = 'px-6 pt-[52px] pb-6 ' + palette.bg
    content = <>
      <p id={textId} className={'my-2 tracking-[-0.02em] whitespace-pre-wrap [overflow-wrap:anywhere] ' + (
        info.shape === 'short' ? 'text-[22px] leading-[1.22] font-extrabold' : 'text-[16px] leading-relaxed font-semibold'
      )}>{text}</p>
      {expandButton}
      <div className="mt-5 flex items-center justify-between gap-2">
        <CardDate value={item.createdAt} className={palette.muted} />
        {copyButton(palette.action)}
      </div>
    </>
  }

  return (
    <motion.article layout {...cardMotion} className={'group cursor-pointer rounded-[30px] ' + liftCard + ' ' + decoration}
      onClick={event => {
        if (event.target instanceof Element && event.target.closest('button, a')) return
        if (window.getSelection()?.toString()) return
        void copy()
      }}>
      {content}
      <span className="sr-only" role="status">{copyState === 'copied' ? 'Заметка скопирована' : ''}</span>
      {copyState === 'error' ? <p className="mt-2 text-sm" role="alert">Не удалось скопировать текст.</p> : null}
    </motion.article>
  )
}

function FileCard({ item, onPreview }: { item: SharedFile; onPreview: (item: SharedFile) => void }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>()
  const size = formatFileSize(item.fileSize)
  const downloadLabel = 'Скачать ' + item.fileName

  if (item.fileCategory === 'image' && item.imageUrl && failedImageUrl !== item.imageUrl) {
    return (
      <motion.article layout {...cardMotion} className="group overflow-hidden rounded-[30px] bg-shared-ink">
        <div className="relative">
          <button type="button" aria-label={'Открыть ' + item.fileName} onClick={() => onPreview(item)}
            className="block h-60 w-full cursor-zoom-in! overflow-hidden focus-visible:-outline-offset-4">
            <img src={item.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedImageUrl(item.imageUrl)}
              className="size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105" />
          </button>
          <div className="glass-image-controls absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-[22px] bg-white/90 p-2.5 pl-4 backdrop-blur-xl">
            <div className="min-w-0">
              <p title={item.fileName} className="truncate text-[14px] font-bold">{item.fileName}</p>
              {size ? <p className="font-mono text-[11px] text-[#646A80]">{size}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
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
      </motion.article>
    )
  }

  return (
    <motion.article layout {...cardMotion} className={'group relative rounded-[30px] bg-[#DCE8FF] text-[#123278] ' + liftCard}>
      <a href={item.downloadUrl} download={item.fileName} aria-label={downloadLabel}
        className="relative block overflow-hidden rounded-[inherit] p-6">
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
          <span className={roundAction + ' size-10 bg-[#102A66] text-white group-hover:bg-indigo-600'}>
            <ArrowDownToLine className="size-4" />
          </span>
        </div>
      </a>
    </motion.article>
  )
}

export const WorkspaceCard = memo(function WorkspaceCard({ item, index, onPreview }: {
  item: SharedItem
  index: number
  onPreview: (item: SharedFile) => void
}) {
  return item.kind === 'note' ? <NoteCard item={item} index={index} /> : <FileCard item={item} onPreview={onPreview} />
})
