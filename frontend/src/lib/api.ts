import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

let _accessToken: string | null = null

export const tokenStore = {
  get: () => _accessToken,
  set: (t: string) => { _accessToken = t },
  clear: () => { _accessToken = null },
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010/api',
  withCredentials: true,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let _isRefreshing = false
let _failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  _failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token as string)
    }
  })
  _failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error)
    }

    if (_isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        _failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    _isRefreshing = true

    try {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh')
      tokenStore.set(data.accessToken)
      processQueue(null, data.accessToken)
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      tokenStore.clear()
      return Promise.reject(refreshError)
    } finally {
      _isRefreshing = false
    }
  }
)

export default api
