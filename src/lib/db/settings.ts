import { db } from './client'
import { encrypt, decrypt } from '@/lib/utils/crypto'

export async function getSettings() {
  return db.settings.findUnique({ where: { id: 'singleton' } })
}

export async function saveMetaToken(token: string, expiresAt?: Date) {
  return db.settings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      metaToken: encrypt(token),
      tokenExpiry: expiresAt,
    },
    update: {
      metaToken: encrypt(token),
      tokenExpiry: expiresAt,
    },
  })
}

export async function getMetaToken(): Promise<string | null> {
  // Always prefer the environment variable so token updates in Railway take effect immediately
  if (process.env.META_ACCESS_TOKEN) {
    return process.env.META_ACCESS_TOKEN
  }
  const settings = await getSettings()
  if (!settings?.metaToken) return null
  return decrypt(settings.metaToken)
}

export async function saveCountries(countries: string[]) {
  return db.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', countries },
    update: { countries },
  })
}
