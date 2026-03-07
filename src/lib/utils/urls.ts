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

export function isSocialMediaUrl(url: string): boolean {
  const socialDomains = [
    'instagram.com',
    'facebook.com',
    'fb.com',
    'fb.watch',
    'twitter.com',
    'x.com',
    'tiktok.com',
    'youtube.com',
    'youtu.be',
    'linkedin.com',
    'pinterest.com',
    'snapchat.com',
    't.me',
    'telegram.me',
    'wa.me',
    'whatsapp.com',
  ]
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return socialDomains.some((d) => hostname === d || hostname.endsWith('.' + d))
  } catch {
    return false
  }
}

export function isFunnelEntryUrl(url: string): boolean {
  const entryPatterns = [
    /\/reto/i,
    /\/challenge/i,
    /\/webinar/i,
    /\/masterclass/i,
    /\/clase/i,
    /\/taller/i,
    /\/workshop/i,
    /\/curso/i,
    /\/training/i,
    /\/registro/i,
    /\/register/i,
    /\/inscri/i,
    /\/signup/i,
    /\/sign-up/i,
    /\/oferta/i,
    /\/offer/i,
    /\/promo/i,
    /\/landing/i,
    /\/lp\//i,
    /\/optin/i,
    /\/opt-in/i,
    /\/lead/i,
    /\/free/i,
    /\/gratis/i,
    /\/regalo/i,
    /\/descarga/i,
    /\/download/i,
    /\/ebook/i,
    /\/guia/i,
    /\/guide/i,
    /\/sesion/i,
    /\/session/i,
    /\/demo/i,
    /\/trial/i,
    /\/prueba/i,
    /\/reserva/i,
    /\/book/i,
  ]
  return entryPatterns.some((p) => p.test(url))
}

export function isLinkInBioService(url: string): boolean {
  const services = [
    'linktr.ee',
    'linktree.com',
    'beacons.ai',
    'bio.link',
    'lnk.bio',
    'campsite.bio',
    'tap.bio',
    'hoo.be',
    'stan.store',
    'snipfeed.co',
    'milkshake.app',
    'withkoji.com',
    'allmylinks.com',
    'linkpop.com',
    'many.link',
    'flow.page',
    'linkin.bio', // Later's linkin.bio
    'later.com',
    'shorby.com',
    'carrd.co',
    'bio.site',
    'contactinbio.com',
    'feedlink.io',
  ]
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return services.some((s) => hostname === s || hostname.endsWith('.' + s))
  } catch {
    return false
  }
}

export function isSkippableUrl(url: string): boolean {
  const skipPatterns = [
    /\/(login|signin|sign-in|iniciar-sesion)\b/i,
    /\/(privacy|privacidad|legal|terms|terminos|cookies|aviso-legal)\b/i,
    /\/(contact|contacto|about|sobre-nosotros|quienes-somos)\b/i,
    /\/(blog|articulo|article|post|noticias|news)$/i,
    /\/(wp-admin|wp-content|wp-includes|wp-json)\b/i,
    /\/(cart|carrito|wishlist)\b/i,
    /\/#[^/]*$/, // anchor-only links
    /\.(pdf|zip|mp3|mp4|avi|mov|doc|docx|xls|xlsx)$/i,
    /mailto:/i,
    /tel:/i,
    /javascript:/i,
  ]
  return skipPatterns.some((p) => p.test(url))
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
