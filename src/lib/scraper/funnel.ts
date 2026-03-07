import { scrapePage } from './puppeteer'
import { detectPageType, isFunnelUrl, isKnownPaymentPlatform, isSameDomain, isSocialMediaUrl } from '@/lib/utils/urls'
import type { ScrapedPageContent } from '@/types/scrape'

const MAX_FUNNEL_DEPTH = 5

export interface FunnelChainStep {
  url: string
  pageType: string
  content: ScrapedPageContent
}

export async function detectFunnelChain(
  entryUrl: string,
  onStep?: (step: FunnelChainStep) => Promise<void>
): Promise<FunnelChainStep[]> {
  const chain: FunnelChainStep[] = []
  const visited = new Set<string>()
  let currentUrl = entryUrl

  for (let depth = 0; depth < MAX_FUNNEL_DEPTH; depth++) {
    if (visited.has(currentUrl)) break
    visited.add(currentUrl)

    const content = await scrapePage(currentUrl)
    const pageType = detectPageType(content.url, content.title ?? undefined)

    const step: FunnelChainStep = { url: content.url, pageType, content }
    chain.push(step)
    if (onStep) await onStep(step)

    // Stop if we reached a thank-you page or checkout (end of funnel)
    if (pageType === 'thank_you' || isKnownPaymentPlatform(content.url)) break

    // Find the next funnel step link
    const nextUrl = findNextFunnelUrl(content.outboundLinks, content.url, visited)
    if (!nextUrl) break

    currentUrl = nextUrl
    // Small delay between pages
    await new Promise((r) => setTimeout(r, 800))
  }

  return chain
}

function findNextFunnelUrl(
  links: string[],
  currentUrl: string,
  visited: Set<string>
): string | null {
  // Exclude social media and already-visited links — they are not funnel steps
  const candidates = links.filter((url) => !visited.has(url) && !isSocialMediaUrl(url))

  // Priority 1: explicit funnel URL patterns on the same domain or a payment platform
  const funnelLinks = candidates.filter(
    (url) => isFunnelUrl(url) && (isSameDomain(url, currentUrl) || isKnownPaymentPlatform(url))
  )
  if (funnelLinks.length > 0) return funnelLinks[0]

  // Priority 2: payment platform links
  const paymentLinks = candidates.filter((url) => isKnownPaymentPlatform(url))
  if (paymentLinks.length > 0) return paymentLinks[0]

  return null
}
