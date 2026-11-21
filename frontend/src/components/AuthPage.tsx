import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, type Session } from '../api'
import { AppTitle } from './AppTitle'
import { InstallAppButton } from './PwaControls'

const minPasswordLength = 6
const inputClass = 'min-h-11 rounded-2xl bg-[#F1F3FA] px-4 text-shared-ink'

export function AuthPage({ online, onAuth }: { online: boolean; onAuth: (session: Session) => void }) {
  const [registering, setRegistering] = useState(false)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => registering ? api.register(login, password) : api.login(login, password),
    onSuccess: onAuth,
    onError: (err: Error) => setError(err.message),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (registering && [...password].length < minPasswordLength) {
      setError('Пароль должен содержать минимум 6 символов.')
      return
    }
    if (registering && password !== confirmation) {
      setError('Пароли не совпадают.')
      return
    }
    setError('')
    mutation.mutate()
  }

  function switchMode() {
    setRegistering(!registering)
    setPassword('')
    setConfirmation('')
    setError('')
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[340px] rounded-[30px] bg-white p-7 shadow-[0_18px_45px_-20px_rgba(20,22,31,0.10)] ring-1 ring-shared-ink/5">
        <AppTitle className="justify-center text-2xl" />
        {!online ? (
          <p className="mt-3 text-center text-sm text-shared-muted" role="status">Для входа нужно подключение к интернету.</p>
        ) : null}
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-semibold">
            Логин
            <input className={inputClass} autoComplete="username" autoCapitalize="none" value={login}
              onChange={event => setLogin(event.target.value)} minLength={3} maxLength={32} required />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Пароль
            <input className={inputClass} type="password" autoComplete={registering ? 'new-password' : 'current-password'}
              value={password} onChange={event => setPassword(event.target.value)}
              minLength={registering ? minPasswordLength : undefined} required />
          </label>
          {registering ? (
            <label className="grid gap-1.5 text-sm font-semibold">
              Повторите пароль
              <input className={inputClass} type="password" autoComplete="new-password" value={confirmation}
                onChange={event => setConfirmation(event.target.value)} required />
            </label>
          ) : null}
          {error ? <p className="text-sm text-shared-error" role="alert">{error}</p> : null}
          <button className="min-h-11 rounded-full bg-shared-ink px-4 text-sm font-bold text-white transition-colors enabled:hover:bg-indigo-600 disabled:opacity-60"
            type="submit" disabled={mutation.isPending}>
            {registering ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>
        <button className="mt-2 min-h-11 w-full rounded-full text-sm font-semibold text-shared-muted hover:text-shared-ink"
          type="button" disabled={mutation.isPending} onClick={switchMode}>
          {registering ? 'Войти' : 'Зарегистрироваться'}
        </button>
        <InstallAppButton className="mt-1 min-h-11 w-full rounded-full bg-[#F1F3FA] px-4 text-sm font-semibold hover:bg-indigo-50" />
      </div>
    </main>
  )
}
