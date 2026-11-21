import { useSyncExternalStore } from 'react'
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { AppTitle } from './components/AppTitle'
import { AuthPage } from './components/AuthPage'
import { Dashboard } from './Dashboard'

const isOnline = () => onlineManager.isOnline()

export default function App() {
  const online = useSyncExternalStore(onlineManager.subscribe, isOnline)
  const queryClient = useQueryClient()
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, retry: 1, refetchOnReconnect: 'always' })
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(['session'], null)
      queryClient.removeQueries({ queryKey: ['items'] })
    },
  })

  if (!online && session.data === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
        <AppTitle className="justify-center text-2xl" />
        <p className="max-w-sm text-sm text-shared-muted" role="status">
          Нет подключения к интернету. Shared загрузит записи, когда связь восстановится.
        </p>
      </main>
    )
  }
  if (session.isPending) {
    return <main className="grid min-h-dvh place-items-center"><p role="status">Загрузка…</p></main>
  }
  if (session.isError && session.data === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
        <AppTitle className="justify-center text-2xl" />
        <p className="text-shared-error" role="alert">Не удалось подключиться к серверу.</p>
        <button className="min-h-11 rounded-full bg-white px-4 text-sm font-bold" type="button"
          onClick={() => void session.refetch()}>Повторить</button>
      </main>
    )
  }
  if (!session.data) {
    return <AuthPage online={online} onAuth={value => {
      logout.reset()
      queryClient.setQueryData(['session'], value)
    }} />
  }

  const userId = session.data.user.id
  return <Dashboard key={userId} userId={userId} online={online} onLogout={() => logout.mutate()} loggingOut={logout.isPending}
    logoutError={logout.error?.message} />
}
