async function startWithRetry(
  name: string,
  fn: () => Promise<void>,
  maxRetries = 3,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fn()
      console.log(`[App] ${name} started successfully`)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[App] ${name} attempt ${attempt}/${maxRetries} failed: ${msg}`)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt))
      }
    }
  }
  console.error(`[App] ${name} failed after ${maxRetries} attempts — running without it`)
}

export async function register() {
  // Only in the Node.js runtime (not Edge, not client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.REDIS_URL) {
      console.warn('[App] REDIS_URL not set — workers disabled. App runs without background jobs.')
      return
    }

    await startWithRetry('BullMQ scrape worker', async () => {
      const { startWorker } = await import('./lib/queue/worker')
      startWorker()
    })

    await startWithRetry('Telegram digest worker', async () => {
      const { startDigestWorker, setupDigestSchedule } = await import('./lib/queue/digestWorker')
      startDigestWorker()
      await setupDigestSchedule()
    })

    await startWithRetry('Market re-analysis worker', async () => {
      const { startMarketWorker, setupMarketSchedule } = await import('./lib/queue/marketWorker')
      startMarketWorker()
      await setupMarketSchedule()
    })
  }
}
