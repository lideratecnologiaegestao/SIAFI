import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

let _portalToken: string | null = null

export const portalTokenStore = {
  get: () => _portalToken,
  set: (t: string) => { _portalToken = t },
  clear: () => { _portalToken = null },
  onAuthLost: null as (() => void) | null,
}

export const portalClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010/api',
  withCredentials: false, // Never send NestJS httpOnly staff cookies in portal requests
})

portalClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = portalTokenStore.get()
  if (!token) {
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession()
      if (session?.access_token) {
        portalTokenStore.set(session.access_token)
        token = session.access_token
      }
    } catch {}
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let _isRefreshing = false
let _failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  _failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token!))
  _failedQueue = []
}

portalClient.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (_isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        _failedQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return portalClient(original)
      }).catch(e => Promise.reject(e))
    }

    original._retry = true
    _isRefreshing = true

    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.refreshSession()
      if (!session?.access_token) throw new Error('no session')
      portalTokenStore.set(session.access_token)
      processQueue(null, session.access_token)
      original.headers.Authorization = `Bearer ${session.access_token}`
      return portalClient(original)
    } catch (e) {
      processQueue(e, null)
      portalTokenStore.clear()
      portalTokenStore.onAuthLost?.()
      return Promise.reject(error)
    } finally {
      _isRefreshing = false
    }
  },
)
