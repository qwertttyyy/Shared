import { applyEdits, createScanner, format, parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser'
import { getSourceLanguage, type SourceLanguage } from './textPreviewFormats.ts'

export type NotePreview =
  | { shape: 'markdown'; text: string }
  | { shape: 'code'; text: string; language?: SourceLanguage; errorLine?: number }

const fencePattern = /^( {0,3})(`{3,}|~{3,})(.*)$/
const markdownBlock = /^ {0,3}(?:#{1,6}[ \t]+\S|>[ \t]*\S|(?:[-+*]|\d+[.)])[ \t]+\S|\S[^\n]*\n {0,3}(?:=+|-+)[ \t]*$)/m
const markdownInline = /(?<!\\)(?:\*\*[^*\s](?:[^*\n]*?[^*\s])?\*\*|__[^_\s](?:[^_\n]*?[^_\s])?__|\[[^\[\]\n]+\]\([^\n)]+\))|(?<![\\\w*])\*[^*\s](?:[^*\n]*?[^*\s])?\*(?!\*)|(?<![\\\w_])_[^_\s](?:[^_\n]*?[^_\s])?_(?![\w_])/
const markdownInlineCode = /(?<![\\`])(`+)[^`\n]+\1(?!`)/
const yamlKey = /^([ \t]*)[A-Za-z_][\w.-]*:(?:[ \t]+(.*))?$/
const assignment = /^[A-Za-z_][\w.-]*[ \t]*=/

const sourcePatterns: [SourceLanguage, RegExp][] = [
  ['typescript', /^[ \t]*(?:(?:export\s+)?(?:interface\s+[\w$]+(?:\s+extends\s+[^\n{]+)?\s*\{|type\s+[\w$]+\s*=)|(?:const|let)\s+[\w$]+\s*:\s*[\w$][^\n=]*=)/m],
  ['python', /^[ \t]*(?:(?:async[ \t]+)?def[ \t]+\w+\s*\([^\n)]*\)\s*(?:->[^\n:]+)?\s*:|from[ \t]+[\w.]+[ \t]+import[ \t]+\w|import[ \t]+[\w.]+[ \t]+as[ \t]+\w)/m],
  ['go', /^[ \t]*package[ \t]+\w+[ \t]*\n[\s\S]*?^[ \t]*(?:import[ \t]+["(]|func[ \t]+\w+\s*\()/m],
  ['rust', /^[ \t]*(?:pub[ \t]+)?(?:fn[ \t]+\w+\s*\(|use[ \t]+[\w:]+::)/m],
  ['java', /^[ \t]*(?:import[ \t]+(?:java|javax)\.|(?:public[ \t]+)?class[ \t]+\w+[\s\S]{0,200}\bstatic[ \t]+void[ \t]+main\s*\()/m],
  ['csharp', /^[ \t]*(?:using[ \t]+System\b[^\n;]*;|namespace[ \t]+\w+(?:\.\w+)+\s*[;{])/m],
  ['cpp', /^[ \t]*(?:#\s*include\s*<(?:iostream|vector|string)>|(?:std::|constexpr\s+)[\w:]+)/m],
  ['c', /^[ \t]*#\s*include\s*<(?:stdio|stdlib|stdint|string)\.h>/m],
  ['php', /^\s*<\?php\b/],
  ['ruby', /^[ \t]*require(?:_relative)?[ \t]+['"][^\n'"]+['"]|^[ \t]*def[ \t]+\w+[^\n]*\n[\s\S]*?^[ \t]*end[ \t]*$/m],
  ['javascript', /^[ \t]*(?:(?:export[ \t]+)?(?:const|let)[ \t]+[\w$]+[ \t]*=|console\.(?:log|error|warn)\s*\(|import[ \t]+[^\n]+[ \t]+from[ \t]+['"])/m],
  ['powershell', /^[ \t]*(?:\$\w+[ \t]*=[ \t]*[^\n]+\n[ \t]*)?(?:(?:Get|Set)-[A-Z][\w-]+|Write-(?:Host|Output|Error))\b/m],
  ['shellscript', /^\s*#![^\n]*\b(?:bash|zsh|sh)\b|^[ \t]*(?:git[ \t]+(?:status|commit|push|pull|log|clone)\b|npm[ \t]+(?:run|install|ci)\b|export[ \t]+\w+=)/m],
  ['sql', /^\s*(?:SELECT\b[\s\S]+\bFROM\s+[\w"`\[]|INSERT\s+INTO\s+\w+|UPDATE\s+\w+\s+SET\s+\w+|CREATE\s+TABLE\s+\w+)/i],
  ['docker', /^\s*FROM[ \t]+\S+[^\n]*\n[\s\S]*?^(?:RUN|COPY|WORKDIR|ENV|CMD|ENTRYPOINT|EXPOSE|ARG)[ \t]+\S/m],
  ['xml', /^\s*<\?xml\s/],
  ['html', /^\s*(?:<!doctype\s+html\b|<html(?:\s|>)|<(?:div|script|style|section)(?:\s[^>]*)?>[\s\S]*<\/(?:div|script|style|section)>)/i],
]

function matchFence(line: string) {
  const match = fencePattern.exec(line)
  if (match?.[2].startsWith('`') && match[3].includes('`')) return null
  return match
}

function fencedPreview(text: string, lines: string[]): NotePreview | undefined {
  const start = lines.findIndex(line => matchFence(line))
  if (start < 0) return
  if (lines.slice(0, start).some(line => line.trim())) return { shape: 'markdown', text }

  const [, indent, marker, info] = matchFence(lines[start])!
  const close = lines.findIndex((line, index) => {
    if (index <= start) return false
    const match = matchFence(line)
    return match && match[2][0] === marker[0] && match[2].length >= marker.length && !match[3].trim()
  })
  if (close !== -1 && lines.slice(close + 1).some(line => line.trim())) return { shape: 'markdown', text }

  const language = getSourceLanguage(info.trim().split(/\s+/, 1)[0])
  const content = lines.slice(start + 1, close < 0 ? undefined : close)
    .map(line => line.slice(Math.min(indent.length, /^ */.exec(line)![0].length))).join('\n')
  const json = language === 'json' || language === 'jsonc' ? jsonPreview(content, language) : undefined
  return json ?? { shape: 'code', text: content, language }
}

function looksLikeJson(text: string): boolean {
  const scanner = createScanner(text, true)
  function nextToken() {
    scanner.scan()
    return text.slice(scanner.getTokenOffset(), scanner.getPosition())
  }

  const first = nextToken()
  if (first !== '{' && first !== '[') return false
  const next = nextToken()
  if (first === '{') return next.startsWith('"') || next === '}'
  if (['{', '[', ']'].includes(next)) return true
  return /^(?:"|-?\d|true$|false$|null$)/.test(next) && [']', ',', ''].includes(nextToken())
}

function hasDeepNesting(node: Node, depth = 0): boolean {
  return depth >= 32 || (node.children?.some(child => hasDeepNesting(child, depth + 1)) ?? false)
}

function jsonPreview(text: string, hint?: 'json' | 'jsonc'): NotePreview | undefined {
  if (!hint && !looksLikeJson(text)) return
  let language = hint ?? 'json'
  try {
    let errors: ParseError[] = []
    let root = parseTree(text, errors, { disallowComments: language === 'json', allowTrailingComma: language === 'jsonc' })
    if (!hint && errors.some(error => printParseErrorCode(error.error) === 'InvalidCommentToken')) {
      language = 'jsonc'
      errors = []
      root = parseTree(text, errors, { allowTrailingComma: true })
    }
    if (errors.length) {
      // A complete value followed by other text can be a Markdown link or a code fragment.
      const rootEnd = root && root.offset + root.length
      if (!hint && rootEnd && /[}\]]/.test(text[rootEnd - 1]) && errors[0].offset >= rootEnd) return
      return { shape: 'code', text, language, errorLine: text.slice(0, errors[0].offset).split('\n').length }
    }
    const formatted = root && !hasDeepNesting(root)
      ? applyEdits(text, format(text, undefined, { tabSize: 2, insertSpaces: true, eol: '\n' }))
      : text
    return { shape: 'code', text: formatted, language }
  } catch {
    // The source can still be shown when nesting exceeds the parser's capacity.
    return { shape: 'code', text, language }
  }
}

function configPreview(lines: string[]): SourceLanguage | 'config' | undefined {
  const rows = lines.filter(line => line.trim() && !/^\s*[#;]/.test(line))
  if (rows.length < 2) return
  if (rows.every(line => /^[A-Z_][A-Z0-9_]*=/.test(line))) return 'dotenv'

  const section = /^\s*(?:\[[\w.-]+\]|\[\[[\w.-]+\]\])\s*$/
  if (rows.some(line => section.test(line)) && rows.every(line => section.test(line) || assignment.test(line.trimStart()))) {
    return rows.some(line => /^\s*\[\[/.test(line)) ? 'toml' : 'config'
  }

  const pairs = rows.map(line => yamlKey.exec(line))
  const keyed = pairs.filter(match => match !== null)
  const allYaml = rows.every((line, index) => pairs[index] || /^\s+-\s+\S|^---[ \t]*$|^\.\.\.[ \t]*$/.test(line))
  const hasNestedBlock = pairs.some((match, index) => match && !match[2]?.trim() && /^\s+\S/.test(rows[index + 1] ?? ''))
  const hasTypedValue = keyed.some(match => /^(?:[-+]?\d+(?:\.\d+)?|true|false|null|~)(?:\s+#.*)?$/i.test(match[2] ?? ''))
  if (allYaml && (hasNestedBlock || (keyed.length >= 2 && hasTypedValue))) return 'yaml'
}

export function detectNotePreview(raw: string): NotePreview | undefined {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const fenced = fencedPreview(text, lines)
  if (fenced) return fenced

  const config = configPreview(lines)
  if (config) return { shape: 'code', text, language: config === 'config' ? undefined : config }

  const json = jsonPreview(text)
  if (json) return json

  const language = sourcePatterns.find(([, pattern]) => pattern.test(text))?.[0]
  if (language) return { shape: 'code', text, language }

  if (/^[ \t]*function[ \t]+\w+\s*\([^\n]*\)[ \t]*\{/m.test(text)) return { shape: 'code', text }
  if (markdownBlock.test(text) || markdownInline.test(text) || markdownInlineCode.test(text)) return { shape: 'markdown', text }
}
