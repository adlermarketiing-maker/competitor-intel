import { extractYouTubeTranscript } from './youtubeOrganic'

/**
 * Transcribe content from a video URL.
 *
 * Strategy:
 *   1. YouTube: Try extracting auto-captions first (free, no API key needed)
 *   2. Fallback: Use OpenAI Whisper API if OPENAI_API_KEY is configured
 *      - Downloads audio via yt-dlp (if installed) or Puppeteer
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
        // Only return first ~2 minutes worth of text (roughly 300 words)
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
    const audioBuffer = await downloadAudio(videoUrl, platform)
    if (!audioBuffer) return null

    return await whisperTranscribe(audioBuffer, apiKey)
  } catch (err) {
    console.error('[Transcribe] Error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Download audio from a video URL using yt-dlp (if available).
 */
async function downloadAudio(
  url: string,
  platform: string,
): Promise<Buffer | null> {
  const { execSync } = await import('child_process')
  const { readFileSync, unlinkSync, existsSync } = await import('fs')
  const { join } = await import('path')
  const { tmpdir } = await import('os')

  const tmpFile = join(tmpdir(), `transcribe_${Date.now()}.mp3`)

  try {
    // Check if yt-dlp is installed
    try {
      execSync('which yt-dlp', { stdio: 'pipe' })
    } catch {
      console.log(`[Transcribe] yt-dlp not installed. Install with: brew install yt-dlp`)
      return null
    }

    // Download audio only, max 120 seconds
    const cmd = platform === 'tiktok'
      ? `yt-dlp --no-check-certificate -x --audio-format mp3 --postprocessor-args "-t 120" -o "${tmpFile}" "${url}" 2>&1`
      : `yt-dlp --no-check-certificate -x --audio-format mp3 --download-sections "*0:00-2:00" -o "${tmpFile}" "${url}" 2>&1`

    execSync(cmd, { timeout: 60000, stdio: 'pipe' })

    // The output file might have a different extension
    const possibleFile = tmpFile.replace('.mp3', '.mp3')
    if (existsSync(possibleFile)) {
      const buffer = readFileSync(possibleFile)
      unlinkSync(possibleFile)
      return buffer
    }

    // Try with the base name (yt-dlp might add extension)
    const baseFile = tmpFile.replace('.mp3', '')
    const glob = await import('fs')
    const files = glob.readdirSync(tmpdir()).filter((f: string) => f.startsWith(`transcribe_${Date.now()}`))
    for (const f of files) {
      const fp = join(tmpdir(), f)
      const buffer = readFileSync(fp)
      unlinkSync(fp)
      return buffer
    }

    return null
  } catch (err) {
    console.error('[Transcribe] yt-dlp error:', err instanceof Error ? err.message : err)
    // Clean up
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile) } catch { /* ignore */ }
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

  // Sort by views and take top N
  const sorted = [...posts]
    .sort((a, b) => b.views - a.views)
    .slice(0, topN)

  for (const post of sorted) {
    const platform = post.platform as 'youtube' | 'tiktok' | 'instagram'
    const transcript = await transcribeVideo(post.url, platform)
    if (transcript) {
      transcripts.set(post.externalId, transcript)
    }
    // Rate limit
    await new Promise((r) => setTimeout(r, 2000))
  }

  return transcripts
}
