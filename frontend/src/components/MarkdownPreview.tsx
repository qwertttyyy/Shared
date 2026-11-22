import Markdown, { type Components } from 'react-markdown'
import { getSourceLanguage } from '../textPreviewFormats'
import { HighlightedText } from './HighlightedText'

const components: Components = {
  img: ({ alt }) => alt ?? null,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
  code: ({ className, children }) => {
    const hint = /^language-(\S+)$/.exec(className ?? '')?.[1]
    const language = hint ? getSourceLanguage(hint) : undefined
    return <code className={className}>
      {language && typeof children === 'string' ? <HighlightedText text={children} language={language} /> : children}
    </code>
  },
}

const inlineComponents: Components = {
  ...components,
  a: ({ children }) => <span className="markdown-link-text">{children}</span>,
}

export default function MarkdownPreview({ text, inline = false }: { text: string; inline?: boolean }) {
  const layout = inline ? 'markdown-preview--inline' : 'mx-auto max-w-[70ch] px-5 py-6 sm:px-10 sm:py-9'
  const Container = inline ? 'div' : 'article'
  return <Container className={'markdown-preview ' + layout}>
    <Markdown skipHtml components={inline ? inlineComponents : components}>{text}</Markdown>
  </Container>
}
