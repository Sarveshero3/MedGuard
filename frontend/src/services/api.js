import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('medguard_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Shared in-flight refresh promise — ensures only one refresh call
// is made even if multiple requests 401 at the same moment.
let refreshTokenPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthRequest = originalRequest?.url?.includes('/auth/')

    // Immediately reject rate-limit errors — do not enter refresh/retry flow
    if (error.response?.status === 429) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('medguard_refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('medguard_token')
        localStorage.removeItem('medguard_refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      // Reuse the in-flight promise if a refresh is already happening
      if (!refreshTokenPromise) {
        refreshTokenPromise = api
          .post('/auth/refresh', { refreshToken })
          .then((res) => {
            const { accessToken, refreshToken: newRefreshToken } = res.data.data
            localStorage.setItem('medguard_token', accessToken)
            localStorage.setItem('medguard_refresh_token', newRefreshToken)
            refreshTokenPromise = null
            return accessToken
          })
          .catch((err) => {
            refreshTokenPromise = null
            localStorage.removeItem('medguard_token')
            localStorage.removeItem('medguard_refresh_token')
            window.location.href = '/login'
            return Promise.reject(err)
          })
      }

      try {
        const newAccessToken = await refreshTokenPromise
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshErr) {
        return Promise.reject(refreshErr)
      }
    }
    return Promise.reject(error)
  }
)

export default api
