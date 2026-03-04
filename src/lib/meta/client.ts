import axios, { AxiosInstance, AxiosResponse } from 'axios'

export function createMetaClient(accessToken: string): AxiosInstance {
  const baseURL = `https://graph.facebook.com/${process.env.META_API_VERSION ?? 'v20.0'}`
  const client = axios.create({
    baseURL,
    params: { access_token: accessToken },
  })

  // Log rate-limit headers in dev
  client.interceptors.response.use((response: AxiosResponse) => {
    if (process.env.NODE_ENV === 'development') {
      const usage = response.headers['x-business-use-case-usage']
      if (usage) {
        try {
          const parsed = JSON.parse(usage)
          console.debug('[Meta Rate Limit]', JSON.stringify(parsed, null, 2))
        } catch {}
      }
    }
    return response
  })

  return client
}
