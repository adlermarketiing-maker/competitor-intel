import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined
}

// Optimize DATABASE_URL for Supabase pooler compatibility
// - pgbouncer=true: required for Supabase's connection pooler (avoids prepared statement errors)
// - connection_limit=2: keep low to avoid MaxClientsInSessionMode on Supabase free tier
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  const params: string[] = []
  if (!url.includes('connection_limit')) params.push('connection_limit=2')
  if (!url.includes('pgbouncer') && url.includes('pooler.supabase.com')) params.push('pgbouncer=true')

  if (params.length === 0) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${params.join('&')}`
}

export const db =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasourceUrl: getDatasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = db
}
