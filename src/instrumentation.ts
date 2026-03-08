export async function register() {
  // Only in the Node.js runtime (not Edge, not client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorker } = await import('./lib/queue/worker')
    startWorker()
    console.log('[App] BullMQ worker started automatically')

    // Start Telegram digest worker and schedule
    try {
      const { startDigestWorker, setupDigestSchedule } = await import('./lib/queue/digestWorker')
      startDigestWorker()
      await setupDigestSchedule()
      console.log('[App] Telegram digest worker started')
    } catch (err) {
      console.error('[App] Failed to start digest worker:', err)
    }
  }
}
