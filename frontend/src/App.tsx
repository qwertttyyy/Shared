import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { AuthPage } from './components/AuthPage'
import { Dashboard } from './Dashboard'

export default function App() {
  const queryClient = useQueryClient()
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, retry: 1 })
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(['session'], null)
      queryClient.removeQueries({ queryKey: ['items'] })
    },
  })

  if (session.isPending) {
    return <main className="grid min-h-dvh place-items-center"><p role="status">Загрузка…</p></main>
  }
  if (session.isError) {
    return (
      <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl font-bold">Shared</h1>
        <p className="text-shared-error" role="alert">Не удалось подключиться к серверу.</p>
        <button className="min-h-11 rounded-full bg-white px-4 text-sm font-bold" type="button"
          onClick={() => void session.refetch()}>Повторить</button>
      </main>
    )
  }
  if (!session.data) {
    return <AuthPage onAuth={value => {
      logout.reset()
      queryClient.setQueryData(['session'], value)
    }} />
  }

  const userId = session.data.user.id
  return <Dashboard key={userId} userId={userId} onLogout={() => logout.mutate()} loggingOut={logout.isPending}
    logoutError={logout.error?.message} />
}
