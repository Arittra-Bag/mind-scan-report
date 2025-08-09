import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { Tables } from '@/integrations/supabase/types'

type Visit = Tables<'visits'>

interface StageGuidanceProps {
  latestVisit: Visit | null
  patientName: string
  locationCountry?: string
}

const CARE_RECS: Record<string, string[]> = {
  Normal: [
    'Maintain Mediterranean-style nutrition rich in fruits, vegetables, whole grains.',
    'Engage in regular aerobic exercise (150 min/week) and resistance training.',
    'Cognitive activities: puzzles, reading, language learning, social engagement.',
  ],
  Very_Mild_Dementia: [
    'Establish routines and use memory aids (journals, phone reminders).',
    'Structured physical activity; consider supervised exercise programs.',
    'Sleep hygiene and stress reduction (CBT, mindfulness).',
  ],
  Mild_Dementia: [
    'Occupational therapy for ADLs; simplify home environment and labels.',
    'Caregiver support resources; consider community programs.',
    'Discuss driving safety and home safety assessments.',
  ],
  Moderate_Dementia: [
    'Advance care planning; safety and fall-risk mitigation.',
    'Caregiver respite support; plan medication administration schedules.',
    'Evaluate need for home health aids or assisted living services.',
  ],
}

function stageToQuery(stage: string | null): string {
  if (!stage) return 'dementia'
  switch (stage) {
    case 'Normal':
      return 'mild cognitive impairment'
    case 'Very_Mild_Dementia':
      return 'very mild dementia'
    case 'Mild_Dementia':
      return 'mild dementia'
    case 'Moderate_Dementia':
      return 'moderate dementia'
    default:
      return 'dementia'
  }
}

export default function StageGuidance({ latestVisit, patientName, locationCountry }: StageGuidanceProps) {
  const [trials, setTrials] = useState<Array<{ id: string; title: string; status: string; locations?: string }>>([])
  const [loadingTrials, setLoadingTrials] = useState(false)

  const stage = latestVisit?.predicted_class || 'Normal'

  const meds = useMemo(() => {
    const fromReport = (latestVisit?.raw_report as any)?.med_recommendations || null
    if (fromReport && Array.isArray(fromReport)) return fromReport
    // fallback static classes
    return [
      { name: 'Cholinesterase inhibitors', examples: ['Donepezil', 'Rivastigmine'], link: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=cholinesterase%20inhibitor' },
      { name: 'NMDA receptor antagonist', examples: ['Memantine'], link: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=memantine' },
      { name: 'Sleep/Behavioral support (non-prescriptive)', examples: ['Melatonin', 'Sleep hygiene'], link: 'https://www.cdc.gov/sleep' },
    ]
  }, [latestVisit])

  useEffect(() => {
    const fetchTrials = async () => {
      try {
        setLoadingTrials(true)
        // Build a fielded expression per Data API docs
        const parts = [
          `AREA[ConditionSearch]${stageToQuery(latestVisit?.predicted_class || null)}`,
          'AREA[OverallStatus]Recruiting',
        ]
        if (locationCountry) {
          parts.push(`AREA[LocationCountry]${locationCountry}`)
        }
        const expr = encodeURIComponent(parts.map(p => `(${p})`).join(' AND '))
        const url = `https://clinicaltrials.gov/api/query/study_fields?expr=${expr}&fields=NCTId,BriefTitle,OverallStatus,LocationCountry,StartDate&min_rnk=1&max_rnk=10&fmt=json`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Trials API error')
        const data = await res.json()
        const items = data?.StudyFieldsResponse?.StudyFields || []
        const mapped = items.map((i: any) => ({
          id: i.NCTId?.[0],
          title: i.BriefTitle?.[0],
          status: i.OverallStatus?.[0],
          locations: i.LocationCountry?.join(', '),
        }))
        setTrials(mapped)
      } catch (e) {
        setTrials([])
      } finally {
        setLoadingTrials(false)
      }
    }
    fetchTrials()
  }, [latestVisit, locationCountry])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Care Recommendations</CardTitle>
          <CardDescription>Stage-tailored, non-prescriptive guidance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(CARE_RECS[stage] || CARE_RECS.Normal).map((tip) => (
              <div key={tip} className="text-sm text-gray-700">• {tip}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Relevant Clinical Trials</CardTitle>
          <CardDescription>Live from clinicaltrials.gov</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTrials ? (
            <div className="text-sm text-gray-500">Loading trials…</div>
          ) : trials.length ? (
            <div className="space-y-3">
              {trials.map((t) => (
                <div key={t.id} className="p-2 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm mr-2">{t.title}</div>
                    <Badge variant="secondary">{t.status}</Badge>
                  </div>
                  <div className="text-xs text-gray-500">{t.locations}</div>
                  <a
                    href={`https://clinicaltrials.gov/study/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:underline mt-1"
                  >
                    View study <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No matching trials found right now.</div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Medication Classes</CardTitle>
          <CardDescription>Information links (not prescriptions)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {meds.map((m: any) => (
              <div key={m.name} className="p-2 border rounded-lg">
                <div className="font-medium text-sm">{m.name}</div>
                {m.examples && (
                  <div className="text-xs text-gray-600">Examples: {m.examples.join(', ')}</div>
                )}
                <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline mt-1">
                  Learn more <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


