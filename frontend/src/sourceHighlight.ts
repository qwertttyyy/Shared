import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLight from '@shikijs/themes/github-light'
import type { SourceLanguage } from './textPreviewFormats'

const loadGrammar = {
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  java: () => import('@shikijs/langs/java'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  rust: () => import('@shikijs/langs/rust'),
  php: () => import('@shikijs/langs/php'),
  ruby: () => import('@shikijs/langs/ruby'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  powershell: () => import('@shikijs/langs/powershell'),
  sql: () => import('@shikijs/langs/sql'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  yaml: () => import('@shikijs/langs/yaml'),
  toml: () => import('@shikijs/langs/toml'),
  ini: () => import('@shikijs/langs/ini'),
  dotenv: () => import('@shikijs/langs/dotenv'),
  docker: () => import('@shikijs/langs/docker'),
  xml: () => import('@shikijs/langs/xml'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
} satisfies Record<SourceLanguage, () => Promise<unknown>>

const highlighter = createHighlighterCore({
  themes: [githubLight],
  langs: [],
  engine: createJavaScriptRegexEngine(),
})

export async function highlightSource(text: string, language: SourceLanguage) {
  const [syntax, grammar] = await Promise.all([highlighter, loadGrammar[language]()])
  await syntax.loadLanguage(grammar.default)
  return syntax.codeToTokens(text, {
    lang: language,
    theme: 'github-light',
    tokenizeMaxLineLength: 2000,
    tokenizeTimeLimit: 250,
  }).tokens
}
