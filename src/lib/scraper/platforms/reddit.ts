/**
 * Reddit scraper using the public JSON API (no auth needed).
 * Appends .json to URLs to get structured data.
 */

const USER_AGENT = 'CompetitorIntel/1.0 (market research bot)'

interface RedditPost {
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
}

interface RedditComment {
  author: string | null
  text: string
  rating: number | null
  date: string | null
}

/**
 * Search Reddit for posts matching keywords.
 */
export async function searchReddit(keyword: string, maxPosts = 8): Promise<RedditPost[]> {
  const posts: RedditPost[] = []

  try {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=${maxPosts}&type=link`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) return []

    const data = await res.json()
    const children = data?.data?.children || []

    for (const child of children) {
      const post = child.data
      if (!post || post.over_18) continue

      posts.push({
        title: post.title || '',
        url: `https://www.reddit.com${post.permalink}`,
        authorName: post.author || null,
        price: null,
        rating: null,
        reviewCount: post.num_comments || null,
        description: (post.selftext || '').slice(0, 300) || null,
      })
    }
  } catch {
    // Silently fail
  }

  return posts.slice(0, maxPosts)
}

/**
 * Scrape comments from a Reddit post URL.
 */
export async function scrapeRedditComments(postUrl: string, maxComments = 20): Promise<RedditComment[]> {
  const comments: RedditComment[] = []

  try {
    // Normalize URL and add .json
    let jsonUrl = postUrl.replace(/\/$/, '')
    if (!jsonUrl.endsWith('.json')) jsonUrl += '.json'
    jsonUrl += '?limit=100&depth=1'

    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) return []

    const data = await res.json()
    // Reddit returns an array: [post, comments]
    const commentListing = data[1]?.data?.children || []

    for (const child of commentListing) {
      if (child.kind !== 't1' || !child.data?.body) continue
      const body = child.data.body.trim()
      if (body.length < 15 || body === '[deleted]' || body === '[removed]') continue

      comments.push({
        author: child.data.author || null,
        text: body.slice(0, 1000), // Limit long comments
        rating: null,
        date: child.data.created_utc
          ? new Date(child.data.created_utc * 1000).toISOString().split('T')[0]
          : null,
      })

      if (comments.length >= maxComments) break
    }
  } catch {
    // Silently fail
  }

  return comments
}
