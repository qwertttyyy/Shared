import type { NotePreview } from '../notePreview'
import { HighlightedText } from './HighlightedText'
import { MarkdownContent } from './MarkdownContent'

const sourceClass = 'min-w-0 font-mono text-[12px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] [tab-size:4] sm:text-[13px]'

export function NoteContentPreview({ preview, layout }: { preview: NotePreview; layout: 'compact' | 'card' | 'full' }) {
  const full = layout === 'full'
  const crop = full ? 'min-w-0' : 'min-w-0 overflow-hidden ' + (layout === 'compact' ? 'max-h-[4.5rem]' : 'max-h-52')
  if (preview.shape === 'markdown') return (
    <div className={crop}>
      <MarkdownContent inline={!full} text={preview.text} fallback={
        <p className={'whitespace-pre-wrap [overflow-wrap:anywhere]' + (full ? ' p-4 sm:p-6' : '')}>{preview.text}</p>
      } />
    </div>
  )

  return <div className={full ? 'min-w-0 p-4 sm:p-6' : 'min-w-0'}>
    <pre dir="ltr" className={crop + ' ' + sourceClass}><code><HighlightedText text={preview.text} language={preview.language} /></code></pre>
    {preview.errorLine === undefined ? null : (
      <p className="mt-2 text-xs font-semibold text-shared-error">
        Ошибка {preview.language === 'jsonc' ? 'JSONC' : 'JSON'} в строке {preview.errorLine}
      </p>
    )}
  </div>
}
