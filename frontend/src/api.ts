export type User = { id: string; login: string; created_at: string }
export type Session = { user: User; csrf_token: string }
export type Item = {
  id: string
  type: 'text' | 'file'
  text?: string
  caption?: string
  original_filename?: string
  content_type?: string
  size?: number
  created_at: string
}
export type ItemsPage = { items: Item[]; total: number; page: number; page_size: number; pages: number }

let csrfToken = ''

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (csrfToken && options.method && options.method.toUpperCase() !== 'GET') headers.set('X-CSRF-Token', csrfToken)

  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(body.error || `Ошибка запроса (${response.status})`, response.status)
  }
  return (await response.json()) as T
}

function rememberSession(session: Session): Session {
  csrfToken = session.csrf_token
  return session
}

export const api = {
  async session(): Promise<Session | null> {
    try {
      return rememberSession(await request<Session>('/auth/me'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  login(login: string, password: string) {
    return request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }).then(rememberSession)
  },
  register(login: string, password: string) {
    return request<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ login, password }) }).then(rememberSession)
  },
  async logout() {
    await request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
    csrfToken = ''
  },
  items(page: number, signal: AbortSignal) {
    return request<ItemsPage>(`/items?page=${page}`, { signal })
  },
  createText(text: string) {
    return request<Item>('/items/text', { method: 'POST', body: JSON.stringify({ text }) })
  },
  upload(file: File, caption: string) {
    const body = new FormData()
    body.append('file', file)
    body.append('caption', caption)
    return request<Item>('/items/file', { method: 'POST', body })
  },
}
