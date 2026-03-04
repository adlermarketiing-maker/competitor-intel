import { config } from 'dotenv'
config({ path: '.env.local' })

import { startWorker } from '@/lib/queue/worker'

const worker = startWorker()

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})
