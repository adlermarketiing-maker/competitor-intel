export interface Client {
  id: string
  name: string
  niche: string | null
  description: string | null
  avatarDesc: string | null
  websiteUrl: string | null
  driveFolder: string | null
  countries: string[]
  notes: string | null
  createdAt: Date
  updatedAt: Date
  _count?: {
    competitors: number
  }
}
