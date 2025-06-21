
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Upload, Calendar, TrendingUp, Download } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Tables } from '@/integrations/supabase/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import MriUploadForm from '@/components/MriUploadForm'

type Patient = Tables<'patients'>
type Visit = Tables<'visits'>

const PatientProfile = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)

  useEffect(() => {
    if (id) {
      fetchPatientData()
    }
  }, [id])

  const fetchPatientData = async () => {
    try {
      // Fetch patient info
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()

      if (patientError) throw patientError

      // Fetch visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false })

      if (visitsError) throw visitsError

      setPatient(patientData)
      setVisits(visitsData || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const getStageColor = (stage: string | null) => {
    switch (stage) {
      case 'Normal': 
      case 'Non Demented': return 'bg-green-100 text-green-800'
      case 'Very Mild Dementia': return 'bg-yellow-100 text-yellow-800'
      case 'Mild Dementia': return 'bg-orange-100 text-orange-800'
      case 'Moderate Dementia': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStage = (stage: string | null) => {
    if (!stage) return 'Processing...'
    return stage.replace(/_/g, ' ')
  }

  const downloadReport = (visit: Visit) => {
    const reportData = {
      visitId: visit.id,
      patientId: visit.patient_id,
      date: visit.created_at,
      predictedClass: visit.predicted_class,
      confidence: visit.confidence,
      insights: visit.insights,
      fullReport: visit.raw_report
    }
    
    const dataStr = JSON.stringify(reportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `mri-report-${new Date(visit.created_at!).toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  // Prepare chart data
  const chartData = visits
    .filter(visit => visit.confidence !== null)
    .map((visit, index) => ({
      visit: `Visit ${visits.length - index}`,
      confidence: visit.confidence ? visit.confidence * 100 : 0,
      date: new Date(visit.created_at!).toLocaleDateString(),
      stage: formatStage(visit.predicted_class)
    }))
    .reverse()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading patient data...</p>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Patient not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{patient.name}</h1>
              <p className="text-gray-600">
                DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
              </p>
              {patient.medical_record_number && (
                <p className="text-gray-600">MRN: {patient.medical_record_number}</p>
              )}
            </div>
            <Button onClick={() => setShowUploadForm(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload MRI Scan
            </Button>
          </div>
        </div>

        {showUploadForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload New MRI Scan</CardTitle>
              <CardDescription>
                Upload an MRI image for dementia analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MriUploadForm
                patientId={patient.id}
                onSuccess={() => {
                  setShowUploadForm(false)
                  fetchPatientData()
                }}
                onCancel={() => setShowUploadForm(false)}
              />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Confidence Trend
              </CardTitle>
              <CardDescription>
                Analysis confidence over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="visit" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${value.toFixed(1)}%`, 'Confidence']}
                      labelFormatter={(label: any) => {
                        const item = chartData.find(d => d.visit === label)
                        return `${label} - ${item?.date} (${item?.stage})`
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="confidence" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No scan data available for trend analysis
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visit Summary</CardTitle>
              <CardDescription>
                Overview of all MRI scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Visits:</span>
                  <span className="font-semibold">{visits.length}</span>
                </div>
                {visits.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Latest Scan:</span>
                      <span className="font-semibold">
                        {new Date(visits[0].created_at!).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Current Status:</span>
                      <Badge className={getStageColor(visits[0].predicted_class)}>
                        {formatStage(visits[0].predicted_class)}
                      </Badge>
                    </div>
                    {visits[0].confidence && (
                      <div className="flex justify-between">
                        <span>Confidence:</span>
                        <span className="font-semibold">
                          {(visits[0].confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Visit History
            </CardTitle>
            <CardDescription>
              Complete history of MRI scans and analysis results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No MRI scans uploaded yet</p>
                <Button 
                  onClick={() => setShowUploadForm(true)}
                  className="mt-4"
                >
                  Upload First Scan
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {visits.map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm font-medium">
                        {new Date(visit.created_at!).toLocaleDateString()}
                      </div>
                      <Badge className={getStageColor(visit.predicted_class)}>
                        {formatStage(visit.predicted_class)}
                      </Badge>
                      {visit.confidence && (
                        <div className="text-sm text-gray-600">
                          {(visit.confidence * 100).toFixed(1)}% confidence
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadReport(visit)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PatientProfile
