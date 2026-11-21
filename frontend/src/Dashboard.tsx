import { lazy, Suspense, useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ItemsPage } from './api'
import type { SaveDraft } from './components/WorkspaceComposer'
import { toSharedItem } from './types'

function WorkspaceLoadError() {
  return (
    <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
      <p className="text-shared-error" role="alert">Не удалось загрузить рабочую область.</p>
      <button className="min-h-11 rounded-full bg-white px-4 text-sm font-bold" type="button"
        onClick={() => window.location.reload()}>Обновить страницу</button>
    </main>
  )
}

const SharedWorkspace = lazy(() => import('./components/SharedWorkspace')
  .catch(() => ({ default: WorkspaceLoadError })))

type DashboardProps = {
  userId: string
  online: boolean
  onLogout: () => void
  loggingOut: boolean
  logoutError?: string
}

function useRealtime(userId: string, online: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!online) return

    let disposed = false
    let socket: WebSocket | undefined
    let reconnect: ReturnType<typeof setTimeout> | undefined
    let attempt = 0

    function refresh() {
      void queryClient.invalidateQueries({ queryKey: ['items', userId] })
    }

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const connection = new WebSocket(`${protocol}//${location.host}/api/ws`)
      socket = connection
      connection.onopen = () => {
        if (disposed) return
        attempt = 0
        refresh()
      }
      connection.onmessage = event => {
        if (disposed) return
        try {
          const message = JSON.parse(event.data as string) as { type?: string }
          if (message.type === 'item.created') refresh()
        } catch { /* Ignore malformed notifications. */ }
      }
      connection.onclose = () => {
        if (disposed) return
        attempt = Math.min(attempt + 1, 5)
        reconnect = setTimeout(connect, Math.min(1000 * 2 ** attempt, 12000))
      }
      connection.onerror = () => connection.close()
    }

    function refreshOnVisible() {
      if (!document.hidden) refresh()
    }

    document.addEventListener('visibilitychange', refreshOnVisible)
    connect()
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', refreshOnVisible)
      clearTimeout(reconnect)
      socket?.close()
    }
  }, [online, queryClient, userId])
}

const pageButton = 'min-h-11 rounded-full bg-white px-4 font-semibold text-shared-ink enabled:hover:bg-indigo-50 disabled:opacity-45'
const selectPage = (data: ItemsPage) => ({ ...data, items: data.items.map(toSharedItem) })

export function Dashboard({ userId, online, onLogout, loggingOut, logoutError }: DashboardProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  useRealtime(userId, online)

  const items = useQuery({
    queryKey: ['items', userId, page],
    queryFn: ({ signal }) => api.items(page, signal),
    refetchOnReconnect: 'always',
    placeholderData: keepPreviousData,
    select: selectPage,
  })

  const save = useMutation({
    mutationFn: async ({ text, attachments, onUploaded }: SaveDraft) => {
      let changed = false
      try {
        if (!attachments.length) {
          await api.createText(text)
          changed = true
        }
        for (const attachment of attachments) {
          await api.upload(attachment.file, text)
          changed = true
          onUploaded(attachment.id)
        }
      } finally {
        if (changed) {
          setPage(1)
          void queryClient.invalidateQueries({ queryKey: ['items', userId] })
        }
      }
    },
  })

  const data = items.isError && online ? undefined : items.data

  return (
    <Suspense fallback={
      <main className="grid min-h-dvh place-items-center"><p role="status">Загрузка…</p></main>
    }>
      <SharedWorkspace items={data?.items ?? []} online={online} loading={items.isFetching} saving={save.isPending}
        onSave={save.mutateAsync} onLogout={onLogout} loggingOut={loggingOut} logoutError={logoutError}>
        {items.isPending && online ? <p className="text-sm text-shared-muted" role="status">Загрузка…</p> : null}
        {items.isError && online ? (
          <div className="text-sm">
            <p className="text-shared-error" role="alert">Не удалось загрузить записи.</p>
            <button type="button" className="mt-2 min-h-11 rounded-full bg-white px-4 font-semibold"
              onClick={() => void items.refetch()}>Повторить</button>
          </div>
        ) : null}
        {data?.items.length === 0 ? <p className="text-sm text-shared-muted">Записей пока нет.</p> : null}
        {data && data.pages > 1 ? (
          <nav className="mt-5 flex items-center justify-between gap-2 text-center text-sm text-shared-muted" aria-label="Страницы списка">
            <button type="button" className={pageButton} disabled={page <= 1 || items.isPlaceholderData}
              onClick={() => setPage(value => value - 1)}>Назад</button>
            <span>Страница {data.page} из {data.pages}</span>
            <button type="button" className={pageButton} disabled={page >= data.pages || items.isPlaceholderData}
              onClick={() => setPage(value => value + 1)}>Далее</button>
          </nav>
        ) : null}
      </SharedWorkspace>
    </Suspense>
  )
}
