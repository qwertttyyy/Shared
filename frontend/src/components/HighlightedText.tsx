import { Fragment, useEffect, useState } from 'react'
import type { highlightSource } from '../sourceHighlight'
import type { SourceLanguage } from '../textPreviewFormats'

type Highlighted = {
  text: string
  language: SourceLanguage
  tokens: Awaited<ReturnType<typeof highlightSource>>
}

export function HighlightedText({ text, language }: { text: string; language?: SourceLanguage }) {
  const [highlighted, setHighlighted] = useState<Highlighted>()

  useEffect(() => {
    if (!language || !text || text.length > 64_000) return
    const source = text.replace(/\r\n?/g, '\n')
    if (source.split('\n', 2001).length > 2000) return
    let active = true
    void import('../sourceHighlight').then(async ({ highlightSource }) => {
      if (!active) return
      const tokens = await highlightSource(source, language)
      if (active) setHighlighted({ text, language, tokens })
    }).catch(() => { /* Keep the visible source when the grammar cannot load or tokenize it. */ })
    return () => { active = false }
  }, [language, text])

  if (highlighted?.text !== text || highlighted.language !== language) return text

  return highlighted.tokens.map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? '\n' : null}
      {line.map((token, offset) => <span key={offset} style={{ color: token.color }}>{token.content}</span>)}
    </Fragment>
  ))
}
