'use client'

import { useState } from 'react'

interface Comment {
  id: string
  author: string | null
  text: string
  rating: number | null
  date: string | null
}

interface Course {
  id: string
  platform: string
  title: string
  url: string
  authorName: string | null
  price: string | null
  rating: number | null
  reviewCount: number | null
  description: string | null
  comments: Comment[]
}

const PLATFORM_COLORS: Record<string, string> = {
  udemy: 'bg-purple-100 text-purple-700',
  hotmart: 'bg-orange-100 text-orange-700',
  skool: 'bg-green-100 text-green-700',
  pylon: 'bg-blue-100 text-blue-700',
  trustpilot: 'bg-emerald-100 text-emerald-700',
  amazon: 'bg-amber-100 text-amber-700',
}

const PLATFORM_LABELS: Record<string, string> = {
  udemy: 'Udemy',
  hotmart: 'Hotmart',
  skool: 'Skool',
  pylon: 'Pylon',
  trustpilot: 'TrustPilot',
  amazon: 'Amazon',
}

export default function PlatformCourseCard({ course }: { course: Course }) {
  const [expanded, setExpanded] = useState(false)
  const shownComments = expanded ? course.comments : course.comments.slice(0, 3)
  const platformColor = PLATFORM_COLORS[course.platform] ?? 'bg-slate-100 text-slate-700'
  const platformLabel = PLATFORM_LABELS[course.platform] ?? course.platform

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${platformColor}`}>
                {platformLabel}
              </span>
              {course.price && (
                <span className="text-xs text-slate-500 font-medium">{course.price}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{course.title}</h3>
            {course.authorName && (
              <p className="text-xs text-slate-500 mt-0.5">{course.authorName}</p>
            )}
          </div>
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-xl transition-colors"
          >
            Ver →
          </a>
        </div>

        {/* Rating + review count */}
        {(course.rating || course.reviewCount) && (
          <div className="flex items-center gap-3 mt-2">
            {course.rating && (
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-semibold text-slate-700">{course.rating.toFixed(1)}</span>
              </div>
            )}
            {course.reviewCount && (
              <span className="text-xs text-slate-400">
                {course.reviewCount.toLocaleString('es-ES')} reseñas
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {course.description && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{course.description}</p>
        )}
      </div>

      {/* Comments */}
      {course.comments.length > 0 ? (
        <div>
          <div className="divide-y divide-slate-50">
            {shownComments.map((comment) => (
              <div key={comment.id} className="px-5 py-3">
                <div className="flex items-start gap-2">
                  {comment.rating && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3 h-3 ${i < comment.rating! ? 'text-amber-400' : 'text-slate-200'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 leading-relaxed">{comment.text}</p>
                    {(comment.author || comment.date) && (
                      <p className="text-xs text-slate-400 mt-1">
                        {comment.author && <span className="font-medium">{comment.author}</span>}
                        {comment.author && comment.date && ' · '}
                        {comment.date && <span>{comment.date}</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {course.comments.length > 3 && (
            <div className="px-5 pb-4 pt-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
              >
                {expanded
                  ? '↑ Ver menos'
                  : `Ver ${course.comments.length - 3} comentarios más ↓`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 italic">Sin comentarios extraídos</p>
        </div>
      )}
    </div>
  )
}
