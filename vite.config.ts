import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { marketService } from './server/market-service.js'

function marketApi(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/market') return next()
    const result = await marketService(url.searchParams, req.method)
    res.statusCode = result.status
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value)
    res.end(JSON.stringify(result.body))
  }
  return {
    name: 'prototype-market-api',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.COINGECKO_DEMO_API_KEY) process.env.COINGECKO_DEMO_API_KEY = env.COINGECKO_DEMO_API_KEY
  return { plugins: [react(), marketApi()], server: { allowedHosts: ['terminal.local'] }, preview: { allowedHosts: ['terminal.local'] } }
})
