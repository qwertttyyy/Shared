import type { Item } from './api'

export type FileCategory = 'archive' | 'image' | 'document' | 'audio' | 'code' | 'other'

type BaseItem = { id: string; createdAt: string }

export type SharedNote = BaseItem & { kind: 'note'; text: string }
export type SharedFile = BaseItem & {
  kind: 'file'
  fileName: string
  fileSize?: number
  fileExt: string
  fileCategory: FileCategory
  caption?: string
  imageUrl?: string
  downloadUrl: string
}
export type SharedItem = SharedNote | SharedFile

export type AnalyzedNote =
  | { shape: 'short' | 'long' | 'code' }
  | { shape: 'link'; url: string; domain: string; path: string }
  | { shape: 'color'; hexColor: string }

const codePatterns = [
  /^(ssh|git|npm|pnpm|yarn|docker|curl|brew|sudo|cd|export)\s+/i,
  /[{};]\s*$/m,
  /^(const|let|var|function|import|export|SELECT|INSERT|FROM)\s+/m,
  /\x60{3}/,
]
const hexPattern = /#([0-9a-f]{6})\b/i
const urlPattern = /^https?:\/\/[^\s]+$/i
const previewTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const extensions: Record<Exclude<FileCategory, 'other'>, readonly string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'dmg', 'apk', 'ipa'],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
  code: ['ts', 'tsx', 'js', 'json', 'py', 'sql', 'sh', 'yaml', 'yml', 'env', 'md'],
  document: ['pdf', 'doc', 'docx', 'fig', 'sketch', 'keynote', 'pptx', 'xlsx', 'csv', 'txt'],
}
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

export function analyzeNote(raw: string): AnalyzedNote {
  const text = raw.trim()
  if (urlPattern.test(text)) {
    try {
      const url = new URL(text)
      return {
        shape: 'link',
        url: url.href,
        domain: url.hostname.replace(/^www\./, ''),
        path: url.pathname !== '/' ? url.pathname + url.search + url.hash : '',
      }
    } catch {
      // An invalid URL can still be a plain-text note.
    }
  }

  const hex = text.match(hexPattern)
  if (hex && text.length <= 42) return { shape: 'color', hexColor: '#' + hex[1].toUpperCase() }
  if (codePatterns.some(pattern => pattern.test(text))) return { shape: 'code' }
  return { shape: text.length <= 54 && !text.includes('\n') ? 'short' : 'long' }
}

function detectFileCategory(ext: string, mimeType?: string): FileCategory {
  if (mimeType?.startsWith('image/')) return 'image'
  for (const category of Object.keys(extensions) as (keyof typeof extensions)[]) {
    if (extensions[category].includes(ext)) return category
  }
  return 'other'
}

export function toSharedItem(item: Item): SharedItem {
  const base = { id: item.id, createdAt: item.created_at }
  if (item.type === 'text') return { ...base, kind: 'note', text: item.text ?? '' }

  const fileName = item.original_filename || 'Файл'
  const fileExt = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
  const ext = fileName.includes('.') && /^[a-z0-9]{1,12}$/.test(fileExt) ? fileExt : 'bin'
  const fileUrl = '/api/items/' + encodeURIComponent(item.id)
  return {
    ...base,
    kind: 'file',
    fileName,
    fileSize: item.size,
    fileExt: ext,
    fileCategory: detectFileCategory(ext, item.content_type),
    caption: item.caption,
    imageUrl: item.content_type && previewTypes.has(item.content_type) ? fileUrl + '/content' : undefined,
    downloadUrl: fileUrl + '/download',
  }
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ'
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ'
}

export function formatDateCompact(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return dateFormat.format(date).replace('.', '') + ', ' + timeFormat.format(date)
}
