export type JobType = 'FULL_SCRAPE' | 'ADS_ONLY' | 'LANDING_PAGES'
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'PARTIAL' | 'FAILED'

export interface ScrapeJob {
  id: string
  competitorId: string
  jobType: JobType
  status: JobStatus
  totalTasks: number
  completedTasks: number
  failedTasks: number
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ScrapeJobData {
  jobDbId: string
  competitorId: string
  jobType: JobType
  countries: string[]
}

export interface ScrapeProgressEvent {
  type: 'progress' | 'status' | 'error'
  message: string
  status?: JobStatus
  completedTasks?: number
  totalTasks?: number
}

export interface MetaAdRaw {
  id: string
  ad_creative_bodies?: string[]
  ad_creative_link_titles?: string[]
  ad_creative_link_descriptions?: string[]
  ad_creative_link_captions?: string[]
  ad_creative_link_url?: string
  ad_delivery_start_time?: string
  ad_delivery_stop_time?: string
  ad_snapshot_url?: string
  page_id?: string
  page_name?: string
  ad_creative_images?: Array<{ original_image_url?: string; resized_image_url?: string }>
  ad_creative_videos?: Array<{ video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }>
  publisher_platforms?: string[]
  eu_total_reach?: number
}

export interface ScrapedPageContent {
  url: string
  originalUrl: string
  title: string | null
  h1Texts: string[]
  h2Texts: string[]
  ctaTexts: string[]
  prices: string[]
  offerName: string | null
  bodyText: string
  screenshotPath: string | null
  outboundLinks: string[]
  httpStatus: number
  error?: string
}
