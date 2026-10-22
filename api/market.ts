import type { IncomingMessage, ServerResponse } from 'node:http'
import { marketService } from '../server/market-service.js'

// Vercel runs this file as a Node function. Secrets stay on the server.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const result = await marketService(url.searchParams, req.method)
  res.statusCode = result.status
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value)
  res.end(JSON.stringify(result.body))
}
