export async function register() {
  // Only in the Node.js runtime (not Edge, not client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.REDIS_URL) {
      console.warn('[App] REDIS_URL not set — workers disabled. App runs without background jobs.')
      return
    }

    try {
      const { startWorker } = await import('./lib/queue/worker')
      startWorker()
      console.log('[App] BullMQ worker started automatically')
    } catch (err) {
      console.error('[App] Failed to start scrape worker:', err)
    }

    // Start Telegram digest worker and schedule
    try {
      const { startDigestWorker, setupDigestSchedule } = await import('./lib/queue/digestWorker')
      startDigestWorker()
      await setupDigestSchedule()
      console.log('[App] Telegram digest worker started')
    } catch (err) {
      console.error('[App] Failed to start digest worker:', err)
    }

    // Start market re-analysis worker and schedule
    try {
      const { startMarketWorker, setupMarketSchedule } = await import('./lib/queue/marketWorker')
      startMarketWorker()
      await setupMarketSchedule()
      console.log('[App] Market re-analysis worker started')
    } catch (err) {
      console.error('[App] Failed to start market worker:', err)
    }
  }
}
