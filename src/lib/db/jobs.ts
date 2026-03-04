import { db } from './client'
import type { JobType, JobStatus } from '@/types/scrape'

export async function createScrapeJob(competitorId: string, jobType: JobType) {
  return db.scrapeJob.create({
    data: { competitorId, jobType, status: 'PENDING' },
  })
}

export async function updateScrapeJob(
  id: string,
  data: Partial<{
    status: JobStatus
    totalTasks: number
    completedTasks: number
    failedTasks: number
    errorMessage: string
    startedAt: Date
    completedAt: Date
  }>
) {
  return db.scrapeJob.update({ where: { id }, data })
}

export async function getScrapeJob(id: string) {
  return db.scrapeJob.findUnique({ where: { id } })
}

export async function getLatestJobForCompetitor(competitorId: string) {
  return db.scrapeJob.findFirst({
    where: { competitorId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listJobsForCompetitor(competitorId: string) {
  return db.scrapeJob.findMany({
    where: { competitorId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}
