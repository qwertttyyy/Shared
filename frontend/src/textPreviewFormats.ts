const sourceExtensions = {
  javascript: ['js', 'mjs', 'cjs'],
  jsx: ['jsx'],
  typescript: ['ts', 'mts', 'cts'],
  tsx: ['tsx'],
  python: ['py', 'pyw'],
  go: ['go'],
  java: ['java'],
  c: ['c', 'h'],
  cpp: ['cc', 'cpp', 'cxx', 'hh', 'hpp', 'hxx'],
  csharp: ['cs'],
  rust: ['rs'],
  php: ['php'],
  ruby: ['rb'],
  shellscript: ['sh', 'bash', 'zsh'],
  powershell: ['ps1', 'psm1', 'psd1'],
  sql: ['sql'],
  json: ['json'],
  jsonc: ['jsonc'],
  yaml: ['yaml', 'yml'],
  toml: ['toml'],
  ini: ['ini'],
  dotenv: ['env'],
  docker: ['dockerfile'],
  xml: ['xml'],
  html: ['html', 'htm'],
  css: ['css'],
} satisfies Record<string, string[]>

export type SourceLanguage = keyof typeof sourceExtensions
export type TextPreviewFormat = 'text' | 'markdown' | SourceLanguage

const formats = new Map<string, TextPreviewFormat>([['txt', 'text'], ['md', 'markdown'], ['markdown', 'markdown']])
formats.set('c++', 'cpp')
formats.set('c#', 'csharp')
formats.set('shell', 'shellscript')
for (const language of Object.keys(sourceExtensions) as SourceLanguage[]) {
  formats.set(language, language)
  for (const ext of sourceExtensions[language]) formats.set(ext, language)
}

export function getSourceLanguage(hint: string): SourceLanguage | undefined {
  const format = formats.get(hint.toLowerCase())
  return format === 'text' || format === 'markdown' ? undefined : format
}

export function getTextPreviewFormat(fileName: string, extension: string): TextPreviewFormat | undefined {
  const name = fileName.toLowerCase()
  if (name === '.env' || name.startsWith('.env.')) return 'dotenv'
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'docker'
  return formats.get(extension)
}
