import { Component, lazy, Suspense, type ReactNode } from 'react'

const MarkdownPreview = lazy(() => import('./MarkdownPreview'))

class MarkdownBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function MarkdownContent({ text, inline, fallback }: { text: string; inline?: boolean; fallback: ReactNode }) {
  return <MarkdownBoundary key={text} fallback={fallback}>
    <Suspense fallback={fallback}>
      <MarkdownPreview text={text} inline={inline} />
    </Suspense>
  </MarkdownBoundary>
}
