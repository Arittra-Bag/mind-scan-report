import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tables } from '@/integrations/supabase/types'

type Visit = Tables<'visits'>

interface VisitComparisonProps {
  visits: Visit[]
}

export default function VisitComparison({ visits }: VisitComparisonProps) {
  const [latest, previous] = useMemo(() => [visits[0], visits[1]], [visits])
  if (!latest || !previous) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visit Comparison</CardTitle>
          <CardDescription>Requires at least 2 visits</CardDescription>
        </CardHeader>
        <CardContent>Not enough data to compare.</CardContent>
      </Card>
    )
  }

  const extractImageDataUrl = (report: any): string | null => {
    if (!report) return null
    const candidates: Array<string | undefined> = [
      report?.dementiaAnalysis?.annotatedImageUrl,
      report?.dementiaAnalysis?.annotated_image_url,
      report?.annotatedImageUrl,
      report?.imageUrl,
      report?.dementiaAnalysis?.annotatedImageBase64,
      report?.dementiaAnalysis?.annotated_image_base64,
      report?.annotatedImageBase64,
      report?.imageBase64,
      report?.image_base64,
    ]
    for (const val of candidates) {
      if (!val) continue
      if (typeof val !== 'string') continue
      if (val.startsWith('data:image/')) return val
      // Heuristic: treat long base64 as png data unless url-like
      if (/^[A-Za-z0-9+/=]+$/.test(val.replace(/\s+/g, '')) && val.length > 100) {
        return `data:image/png;base64,${val}`
      }
      if (/^https?:\/\//.test(val)) return val
    }
    return null
  }

  // Prefer stored URLs if present, else fall back to embedded report data
  const latestStored = (latest as any).annotated_image_url || (latest as any).image_url || null
  const prevStored = (previous as any).annotated_image_url || (previous as any).image_url || null
  const latestImg = latestStored || extractImageDataUrl((latest.raw_report as any))
  const prevImg = prevStored || extractImageDataUrl((previous.raw_report as any))

  const latestConf = latest.confidence ? (latest.confidence * 100).toFixed(1) + '%' : 'N/A'
  const prevConf = previous.confidence ? (previous.confidence * 100).toFixed(1) + '%' : 'N/A'
  const delta = latest.confidence != null && previous.confidence != null
    ? ((latest.confidence - previous.confidence) * 100).toFixed(1) + '%'
    : 'N/A'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit Comparison</CardTitle>
        <CardDescription>Side-by-side view of last two scans</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-2">Previous</div>
            {prevImg ? (
              <img src={prevImg} alt="Previous" className="w-full rounded-lg border" />
            ) : (
              <div className="h-48 flex items-center justify-center border rounded-lg text-gray-400">No image</div>
            )}
            <div className="mt-2 text-sm">Stage: {previous.predicted_class?.replace(/_/g, ' ') || 'Processing'}</div>
            <div className="text-sm text-gray-600">Confidence: {prevConf}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-2">Latest</div>
            {latestImg ? (
              <img src={latestImg} alt="Latest" className="w-full rounded-lg border" />
            ) : (
              <div className="h-48 flex items-center justify-center border rounded-lg text-gray-400">No image</div>
            )}
            <div className="mt-2 text-sm">Stage: {latest.predicted_class?.replace(/_/g, ' ') || 'Processing'}</div>
            <div className="text-sm text-gray-600">Confidence: {latestConf}</div>
          </div>
        </div>
        <div className="mt-4 text-sm font-medium">Confidence change: {delta}</div>
      </CardContent>
    </Card>
  )
}


