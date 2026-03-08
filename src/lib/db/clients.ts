import { db } from './client'

export async function listClients() {
  return db.client.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { competitors: true } },
    },
  })
}

export async function getClient(id: string) {
  return db.client.findUnique({
    where: { id },
    include: {
      _count: { select: { competitors: true } },
    },
  })
}

export async function createClient(data: {
  name: string
  niche?: string
  description?: string
  avatarDesc?: string
  websiteUrl?: string
  driveFolder?: string
  countries?: string[]
  notes?: string
}) {
  return db.client.create({ data })
}

export async function updateClient(
  id: string,
  data: Partial<{
    name: string
    niche: string | null
    description: string | null
    avatarDesc: string | null
    websiteUrl: string | null
    driveFolder: string | null
    countries: string[]
    notes: string | null
  }>
) {
  return db.client.update({ where: { id }, data })
}

export async function deleteClient(id: string) {
  return db.client.delete({ where: { id } })
}
