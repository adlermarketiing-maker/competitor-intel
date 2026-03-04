export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove trailing slash
    return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search + parsed.hash
  } catch {
    return url
  }
}

export function isSameDomain(url1: string, url2: string): boolean {
  try {
    return new URL(url1).hostname === new URL(url2).hostname
  } catch {
    return false
  }
}

export function isFunnelUrl(url: string): boolean {
  const funnelPatterns = [
    /\/upsell/i,
    /\/oto/i,
    /\/checkout/i,
    /\/order/i,
    /\/comprar/i,
    /\/pago/i,
    /\/gracias/i,
    /\/thank/i,
    /\/confirmation/i,
    /\/confirmacion/i,
    /\/success/i,
    /\/exito/i,
    /\/downsell/i,
    /\/bump/i,
  ]
  return funnelPatterns.some((p) => p.test(url))
}

export function detectPageType(url: string, title?: string): string {
  const lower = url.toLowerCase()
  const titleLower = (title || '').toLowerCase()

  if (/gracias|thank|confirmation|confirmacion|success|exito/.test(lower + titleLower)) {
    return 'thank_you'
  }
  if (/checkout|order|pago|comprar|pay/.test(lower + titleLower)) {
    return 'checkout'
  }
  if (/upsell|oto|oferta-especial|oferta-unica/.test(lower + titleLower)) {
    return 'upsell'
  }
  if (/downsell/.test(lower + titleLower)) {
    return 'downsell'
  }
  return 'landing'
}

export function isKnownPaymentPlatform(url: string): boolean {
  const platforms = [
    'hotmart.com',
    'hotmart.net',
    'eduzz.com',
    'kiwify.com',
    'monetizze.com',
    'paypro.global',
    'clickbank.com',
    'samcart.com',
    'kajabi.com',
    'teachable.com',
    'thinkific.com',
    'checkout.stripe.com',
    'paypal.com',
  ]
  try {
    const hostname = new URL(url).hostname
    return platforms.some((p) => hostname.includes(p))
  } catch {
    return false
  }
}
