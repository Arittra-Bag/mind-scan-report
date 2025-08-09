import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tables } from '@/integrations/supabase/types'
import { Download } from 'lucide-react'

type Visit = Tables<'visits'>

interface ResearchExportProps {
  visits: Visit[]
}

function toCSV(rows: any[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
  return csv
}

export default function ResearchExport({ visits }: ResearchExportProps) {
  const exportAll = () => {
    const rows = visits.map((v) => ({
      date: new Date(v.created_at!).toISOString(),
      patient_id: v.patient_id,
      stage: v.predicted_class || '',
      confidence: v.confidence ?? '',
      insights_len: v.insights ? v.insights.length : 0,
    }))
    const blob = new Blob([toCSV(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'visits.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAnonymized = () => {
    // Keep metrics, strip PHI
    const rows = visits.map((v, idx) => ({
      anon_id: `P${idx + 1}`,
      date: new Date(v.created_at!).toISOString(),
      stage: v.predicted_class || '',
      confidence: v.confidence ?? '',
      insights_len: v.insights ? v.insights.length : 0,
    }))
    const blob = new Blob([toCSV(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'visits_anonymized.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research & Export</CardTitle>
        <CardDescription>One-click exports for analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Button onClick={exportAll} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={exportAnonymized} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export Anonymized CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


