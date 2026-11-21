import React from 'react'
import ReactDOM from 'react-dom/client'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AppUpdateNotice } from './components/PwaControls'
import { startPwa } from './pwa'

onlineManager.setOnline(navigator.onLine)
startPwa()
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { networkMode: 'always' },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <AppUpdateNotice />
    </QueryClientProvider>
  </React.StrictMode>,
)
