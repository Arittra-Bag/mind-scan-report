import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tables } from '@/integrations/supabase/types'

type Visit = Tables<'visits'>

interface PatientTimelineProps {
  visits: Visit[]
}

export default function PatientTimeline({ visits }: PatientTimelineProps) {
  const items = [...visits].sort(
    (a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {items.map((v) => (
              <div key={v.id} className="relative">
                <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-blue-500" />
                <div className="bg-white border rounded-lg p-3">
                  <div className="text-sm text-gray-500">{new Date(v.created_at!).toLocaleString()}</div>
                  <div className="text-sm">
                    Stage: {v.predicted_class?.replace(/_/g, ' ') || 'Processing'}
                    {v.confidence != null && (
                      <span className="text-gray-600"> — {(v.confidence * 100).toFixed(1)}%</span>
                    )}
                  </div>
                  {v.insights && (
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">{v.insights}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


