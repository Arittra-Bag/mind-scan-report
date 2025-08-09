import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { Tables } from '@/integrations/supabase/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type Visit = Tables<'visits'>

interface InsightsPanelProps {
  visits: Visit[]
  patientName: string
}

function mapStageToIndex(stage: string | null): number {
  if (!stage) return 0
  const mapping: Record<string, number> = {
    Normal: 0,
    Very_Mild_Dementia: 1,
    Mild_Dementia: 2,
    Moderate_Dementia: 3,
  }
  return mapping[stage] ?? 0
}

function mapIndexToStage(idx: number): string {
  const stages = ['Normal', 'Very Mild', 'Mild', 'Moderate']
  const clamped = Math.max(0, Math.min(3, Math.round(idx)))
  return stages[clamped]
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function extractClassConfidences(raw: any): Record<string, number> | null {
  const confidences = raw?.dementiaAnalysis?.confidences
  if (confidences && typeof confidences === 'object') return confidences as Record<string, number>
  return null
}

export default function InsightsPanel({ visits, patientName }: InsightsPanelProps) {
  const sorted = [...visits].sort(
    (a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
  )

  const stageSeries = sorted.map((v, i) => ({
    idx: i,
    stageIndex: mapStageToIndex(v.predicted_class),
    label: v.created_at ? new Date(v.created_at).toLocaleDateString() : `Visit ${i + 1}`,
  }))

  const confidenceSeries = sorted.map((v, i) => ({
    idx: i,
    confidence: v.confidence ?? null,
  }))

  // Simple linear trend forecast on stage index
  let forecastPoints: { label: string; value: number }[] = []
  if (stageSeries.length >= 2) {
    const n = stageSeries.length
    const xMean = stageSeries.reduce((acc, p) => acc + p.idx, 0) / n
    const yMean = stageSeries.reduce((acc, p) => acc + p.stageIndex, 0) / n
    const numerator = stageSeries.reduce((acc, p) => acc + (p.idx - xMean) * (p.stageIndex - yMean), 0)
    const denominator = stageSeries.reduce((acc, p) => acc + (p.idx - xMean) ** 2, 0) || 1
    const slope = numerator / denominator
    const intercept = yMean - slope * xMean
    const lastIdx = stageSeries[n - 1].idx
    const next1 = slope * (lastIdx + 1) + intercept
    const next2 = slope * (lastIdx + 2) + intercept
    forecastPoints = [
      { label: 'Next visit', value: next1 },
      { label: '6 months', value: next2 },
    ]
  }

  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]

  const confidenceDrop =
    latest?.confidence != null && prev?.confidence != null
      ? latest.confidence - prev.confidence
      : null

  // Change highlights using class confidences delta between last two visits if present
  let deltas: { label: string; delta: number }[] = []
  try {
    const latestConf = extractClassConfidences(latest?.raw_report)
    const prevConf = extractClassConfidences(prev?.raw_report)
    if (latestConf && prevConf) {
      const labels = new Set([...Object.keys(latestConf), ...Object.keys(prevConf)])
      deltas = Array.from(labels).map((k) => ({ label: k, delta: (latestConf[k] || 0) - (prevConf[k] || 0) }))
      deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      deltas = deltas.slice(0, 3)
    }
  } catch {}

  const chartData = [
    ...stageSeries.map((p) => ({ label: p.label, Stage: p.stageIndex })),
    ...(forecastPoints.length
      ? forecastPoints.map((p) => ({ label: p.label, Forecast: Math.max(0, Math.min(3, p.value)) }))
      : []),
  ]

  const riskProbability = (() => {
    if (!forecastPoints.length) return null
    const current = stageSeries[stageSeries.length - 1].stageIndex
    const projected = Math.max(0, Math.min(3, forecastPoints[forecastPoints.length - 1].value))
    const delta = projected - current
    const prob = Math.max(0, Math.min(1, delta / 2))
    return prob
  })()

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Disease Progression Prediction
          </CardTitle>
          <CardDescription>
            {riskProbability != null
              ? `Estimated risk of worsening within ~6 months: ${formatPct(riskProbability)}`
              : 'Forecast requires at least 2 visits'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stageSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} />
                <Tooltip formatter={(v: any, n: any) => (n === 'Stage' || n === 'Forecast' ? mapIndexToStage(v as number) : v)} />
                <ReferenceLine y={0} stroke="#16a34a" strokeDasharray="4 4" />
                <ReferenceLine y={1} stroke="#ca8a04" strokeDasharray="4 4" />
                <ReferenceLine y={2} stroke="#ea580c" strokeDasharray="4 4" />
                <ReferenceLine y={3} stroke="#dc2626" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Stage" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                {forecastPoints.length > 0 && (
                  <Line type="monotone" dataKey="Forecast" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No data to forecast</div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {confidenceDrop != null && confidenceDrop < -0.15 && (
          <Alert variant="warning" className="border-yellow-300">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Confidence Alert</AlertTitle>
            <AlertDescription>
              Confidence decreased by {formatPct(Math.abs(confidenceDrop))} since the last visit. Consider re-scanning in 3 months.
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30">
          <CardHeader>
            <CardTitle>Change Highlights</CardTitle>
            <CardDescription>
              Model probability changes between the last two visits
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deltas.length ? (
              <div className="space-y-2">
                {deltas.map((d) => (
                  <div key={d.label} className="flex justify-between text-sm">
                    <span className="text-gray-700">{d.label}</span>
                    <span className={d.delta >= 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                      {d.delta >= 0 ? '+' : ''}{(d.delta * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">Not enough data to compute changes</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


