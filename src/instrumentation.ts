export async function register() {
  // Only in the Node.js runtime (not Edge, not client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorker } = await import('./lib/queue/worker')
    startWorker()
    console.log('[App] BullMQ worker started automatically')
  }
}
