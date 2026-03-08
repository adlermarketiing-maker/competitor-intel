import { extractYouTubeTranscript } from './youtubeOrganic'

/**
 * Transcribe content from a video URL.
 *
 * Strategy:
 *   1. YouTube: Try extracting auto-captions first (free, no API key needed)
 *   2. Fallback: Use OpenAI Whisper API if OPENAI_API_KEY is configured
 *      - Downloads audio via yt-dlp (if installed)
 *      - Sends to Whisper for transcription
 *
 * Only transcribes the first ~2 minutes for hooks.
 */
export async function transcribeVideo(
  videoUrl: string,
  platform: 'youtube' | 'tiktok' | 'instagram',
): Promise<string | null> {
  // YouTube: try auto-captions first (free)
  if (platform === 'youtube') {
    try {
      const transcript = await extractYouTubeTranscript(videoUrl)
      if (transcript && transcript.length > 20) {
        const words = transcript.split(/\s+/)
        return words.slice(0, 300).join(' ')
      }
    } catch {
      // Fall through to Whisper
    }
  }

  // For TikTok/Instagram or YouTube without captions: use Whisper API
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.log('[Transcribe] OPENAI_API_KEY not configured, skipping transcription')
    return null
  }

  try {
    const audioBuffer = await downloadAudio(videoUrl)
    if (!audioBuffer) return null

    return await whisperTranscribe(audioBuffer, apiKey)
  } catch (err) {
    console.error('[Transcribe] Error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Validate URL to prevent command injection.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Download audio from a video URL using yt-dlp (if available).
 */
async function downloadAudio(url: string): Promise<Buffer | null> {
  if (!isValidUrl(url)) {
    console.error('[Transcribe] Invalid URL, skipping download')
    return null
  }

  const { execFileSync, execSync } = await import('child_process')
  const { readFileSync, unlinkSync, existsSync, readdirSync } = await import('fs')
  const { join } = await import('path')
  const { tmpdir } = await import('os')

  const timestamp = Date.now()
  const tmpBase = join(tmpdir(), `transcribe_${timestamp}`)
  const tmpFile = `${tmpBase}.mp3`

  try {
    // Check if yt-dlp is installed
    try {
      execSync('which yt-dlp', { stdio: 'pipe' })
    } catch {
      console.log('[Transcribe] yt-dlp not installed. Install with: brew install yt-dlp')
      return null
    }

    // Use execFileSync to avoid shell injection — pass args as array
    const args = [
      '--no-check-certificate',
      '-x',
      '--audio-format', 'mp3',
      '--download-sections', '*0:00-2:00',
      '-o', tmpFile,
      url,
    ]

    execFileSync('yt-dlp', args, { timeout: 60000, stdio: 'pipe' })

    // yt-dlp might output with slightly different name/extension
    if (existsSync(tmpFile)) {
      const buffer = readFileSync(tmpFile)
      unlinkSync(tmpFile)
      return buffer
    }

    // Scan for files matching our timestamp prefix
    const prefix = `transcribe_${timestamp}`
    const dir = tmpdir()
    const files = readdirSync(dir).filter((f) => f.startsWith(prefix))
    for (const f of files) {
      const fp = join(dir, f)
      const buffer = readFileSync(fp)
      unlinkSync(fp)
      return buffer
    }

    return null
  } catch (err) {
    console.error('[Transcribe] yt-dlp error:', err instanceof Error ? err.message : err)
    // Clean up any leftover temp files
    try {
      const prefix = `transcribe_${timestamp}`
      const dir = tmpdir()
      const files = readdirSync(dir).filter((f) => f.startsWith(prefix))
      for (const f of files) {
        try { unlinkSync(join(dir, f)) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    return null
  }
}

/**
 * Send audio to OpenAI Whisper API for transcription.
 */
async function whisperTranscribe(audioBuffer: Buffer, apiKey: string): Promise<string | null> {
  try {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' })
    formData.append('file', blob, 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Whisper] API error:', errText)
      return null
    }

    const result = await response.json() as { text: string }
    return result.text || null
  } catch (err) {
    console.error('[Whisper] Error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Batch transcribe top videos from a list.
 * Only transcribes the top N by views.
 */
export async function batchTranscribe(
  posts: Array<{ url: string; platform: string; views: number; externalId: string }>,
  topN = 10,
): Promise<Map<string, string>> {
  const transcripts = new Map<string, string>()

  const sorted = [...posts]
    .sort((a, b) => b.views - a.views)
    .slice(0, topN)

  for (const post of sorted) {
    const platform = post.platform as 'youtube' | 'tiktok' | 'instagram'
    const transcript = await transcribeVideo(post.url, platform)
    if (transcript) {
      transcripts.set(post.externalId, transcript)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  return transcripts
}
