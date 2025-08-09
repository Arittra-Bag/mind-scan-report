
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Upload, Calendar, TrendingUp, Download, Clock, AlertTriangle, Activity } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Tables } from '@/integrations/supabase/types'
import MriUploadForm from '@/components/MriUploadForm'
import AnimatedMetricCard from '@/components/AnimatedMetricCard'
import TrendChart from '@/components/TrendChart'
import InsightsPanel from '@/components/InsightsPanel'
import StageGuidance from '@/components/StageGuidance'
import ResearchExport from '@/components/ResearchExport'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
      case 'Normal': return 'bg-green-100 text-green-800 border-green-200'
      case 'Very_Mild_Dementia': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Mild_Dementia': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Moderate_Dementia': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatStage = (stage: string | null) => {
    if (!stage) return 'Processing...'
    return stage.replace(/_/g, ' ')
  }

  const downloadPDF = async (visit: Visit) => {
    try {
      // Prefer ConvertAPI Template → PDF if configured
      const CONVERTAPI_TOKEN = import.meta.env.VITE_CONVERTAPI_TOKEN || 'dJm4aDVUZ43brLbyl35TEkipglExr83E'
      const TEMPLATE_URL = import.meta.env.VITE_CONVERTAPI_TEMPLATE_URL // public URL to a .docx template with placeholders

      if (CONVERTAPI_TOKEN && TEMPLATE_URL) {
        try {
          const scanDate = new Date(visit.created_at!).toLocaleDateString()
          const confidencePercent = visit.confidence ? (visit.confidence * 100).toFixed(1) + '%' : 'N/A'
          const dementiaClass = formatStage(visit.predicted_class)

          const payload = {
            patient: {
              name: patient!.name,
              date_of_birth: new Date(patient!.date_of_birth).toLocaleDateString(),
              medical_record_number: patient!.medical_record_number || '',
            },
            scan: {
              date: scanDate,
              diagnosis: dementiaClass,
              confidence: confidencePercent,
            },
            insights: visit.insights || '',
          }

          const formData = new FormData()
          formData.append('File', TEMPLATE_URL)
          formData.append('JsonPayload', JSON.stringify(payload))
          formData.append('StoreFile', 'true')
          formData.append('BindingMethod', 'placeholders')

          const res = await fetch('https://v2.convertapi.com/convert/template/to/pdf', {
            method: 'POST',
            headers: { Authorization: `Bearer ${CONVERTAPI_TOKEN}` },
            body: formData,
          })

          if (!res.ok) throw new Error(`ConvertAPI failed: ${res.status}`)
          const data = await res.json()
          const fileUrl: string | undefined = data?.Files?.[0]?.Url || data?.File?.Url || data?.Url
          const fileName: string = data?.Files?.[0]?.FileName || `mri-report-${patient!.name.replace(/\s+/g, '-')}-${new Date(visit.created_at!).toISOString().split('T')[0]}.pdf`
          if (!fileUrl) throw new Error('ConvertAPI response missing file URL')

          const pdfResp = await fetch(fileUrl)
          if (!pdfResp.ok) throw new Error(`Failed to fetch generated PDF: ${pdfResp.status}`)
          const blob = await pdfResp.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)

          toast({ title: 'Success', description: 'Report downloaded successfully' })
          return
        } catch (err) {
          console.warn('ConvertAPI failed, falling back to local PDF generation:', err)
        }
      }

      // Second attempt: ConvertAPI HTML → PDF using generated HTML (no template needed)
      if (CONVERTAPI_TOKEN) {
        try {
          const scanDate = new Date(visit.created_at!).toLocaleDateString()
          const confidencePercent = visit.confidence ? (visit.confidence * 100).toFixed(1) + '%' : 'N/A'
          const dementialClass = formatStage(visit.predicted_class)

          const html = `
            <html><head><meta charset="utf-8" /><style>
              body{font-family:Arial, sans-serif; padding:20px}
              .section{margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #eee}
              .center{text-align:center}
              .insights{white-space:pre-wrap; padding:10px; background-color:#f9f9f9; border-radius:5px; font-size:0.9em}
            </style></head><body>
              <div class="center">
                <h1 style="margin-bottom:5px;">Mind Scan Report</h1>
                <h2 style="margin-top:0; color:#555; font-weight:normal;">MRI Analysis Results</h2>
              </div>
              <div class="section">
                <h3 style="margin-bottom:10px;">Patient Information</h3>
                <p><strong>Name:</strong> ${patient!.name}</p>
                <p><strong>DOB:</strong> ${new Date(patient!.date_of_birth).toLocaleDateString()}</p>
                ${patient!.medical_record_number ? `<p><strong>MRN:</strong> ${patient!.medical_record_number}</p>` : ''}
              </div>
              <div class="section">
                <h3 style="margin-bottom:10px;">Scan Details</h3>
                <p><strong>Scan Date:</strong> ${scanDate}</p>
                <p><strong>Diagnosis:</strong> ${dementialClass}</p>
                <p><strong>Confidence:</strong> ${confidencePercent}</p>
              </div>
              ${visit.insights ? `<div class="section"><h3 style="margin-bottom:10px;">Analysis Insights</h3><div class="insights">${visit.insights.replace(/\n/g, '<br>')}</div></div>` : ''}
              <div style="margin-top:30px; text-align:center; font-size:0.8em; color:#777;">
                <p>This report was generated on ${new Date().toLocaleString()}.</p>
                <p>Mind Scan Analysis Platform. All rights reserved.</p>
              </div>
            </body></html>
          `

          const formData = new FormData()
          const htmlBlob = new Blob([html], { type: 'text/html' })
          formData.append('File', htmlBlob, 'report.html')
          formData.append('StoreFile', 'true')

          const res = await fetch('https://v2.convertapi.com/convert/html/to/pdf', {
            method: 'POST',
            headers: { Authorization: `Bearer ${CONVERTAPI_TOKEN}` },
            body: formData,
          })

          if (!res.ok) throw new Error(`ConvertAPI HTML->PDF failed: ${res.status}`)
          const data = await res.json()
          const fileUrl: string | undefined = data?.Files?.[0]?.Url || data?.File?.Url || data?.Url
          const fileName: string = data?.Files?.[0]?.FileName || `mri-report-${patient!.name.replace(/\s+/g, '-')}-${new Date(visit.created_at!).toISOString().split('T')[0]}.pdf`
          if (!fileUrl) throw new Error('ConvertAPI HTML->PDF response missing file URL')

          const pdfResp = await fetch(fileUrl)
          if (!pdfResp.ok) throw new Error(`Failed to fetch generated PDF: ${pdfResp.status}`)
          const blob = await pdfResp.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)

          toast({ title: 'Success', description: 'Report downloaded successfully' })
          return
        } catch (err) {
          console.warn('ConvertAPI HTML path failed, falling back to local PDF generation:', err)
        }
      }

      // Fallback: generate PDF from HTML locally
      const reportContainer = document.createElement('div')
      reportContainer.style.padding = '20px'
      reportContainer.style.fontFamily = 'Arial, sans-serif'
      reportContainer.style.position = 'absolute'
      reportContainer.style.left = '-9999px'
      reportContainer.style.top = '-9999px'
      reportContainer.style.width = '550px'
      document.body.appendChild(reportContainer)

      const scanDate = new Date(visit.created_at!).toLocaleDateString()
      const confidencePercent = visit.confidence ? (visit.confidence * 100).toFixed(1) + '%' : 'N/A'
      const dementialClass = formatStage(visit.predicted_class)

      reportContainer.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
          <h1 style="margin-bottom:5px;">Mind Scan Report</h1>
          <h2 style="margin-top:0; color:#555; font-weight:normal;">MRI Analysis Results</h2>
        </div>
        <div style="margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #eee;">
          <h3 style="margin-bottom:10px;">Patient Information</h3>
          <p><strong>Name:</strong> ${patient!.name}</p>
          <p><strong>DOB:</strong> ${new Date(patient!.date_of_birth).toLocaleDateString()}</p>
          ${patient!.medical_record_number ? `<p><strong>MRN:</strong> ${patient!.medical_record_number}</p>` : ''}
        </div>
        <div style="margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #eee;">
          <h3 style="margin-bottom:10px;">Scan Details</h3>
          <p><strong>Scan Date:</strong> ${scanDate}</p>
          <p><strong>Diagnosis:</strong> ${dementialClass}</p>
          <p><strong>Confidence:</strong> ${confidencePercent}</p>
        </div>
        ${visit.insights ? `
        <div style="margin-bottom:20px;">
          <h3 style="margin-bottom:10px;">Analysis Insights</h3>
          <div style="white-space:pre-wrap; padding:10px; background-color:#f9f9f9; border-radius:5px; font-size:0.9em;">
            ${visit.insights.replace(/\n/g, '<br>')}
          </div>
        </div>` : ''}
        <div style="margin-top:30px; text-align:center; font-size:0.8em; color:#777;">
          <p>This report was generated on ${new Date().toLocaleString()}.</p>
          <p>Mind Scan Analysis Platform. All rights reserved.</p>
        </div>
      `

      const pdf = new jsPDF('p', 'mm', 'a4')
      const canvas = await html2canvas(reportContainer, { scale: 2, logging: false, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      if (pdfHeight > 297) {
        let remainingHeight = pdfHeight
        let position = -297
        while (remainingHeight > 0) {
          pdf.addPage()
          position -= 297
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
          remainingHeight -= 297
        }
      }
      const filename = `mri-report-${patient!.name.replace(/\s+/g, '-')}-${new Date(visit.created_at!).toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
      document.body.removeChild(reportContainer)

      toast({ title: 'Success', description: 'Report downloaded successfully' })
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({ title: 'Error', description: 'Failed to generate PDF report', variant: 'destructive' })
    }
  }

  // Business metrics calculations
  const calculatePatientMetrics = () => {
    const processedVisits = visits.filter(v => v.predicted_class && v.confidence)
    const avgConfidence = processedVisits.length > 0 
      ? (processedVisits.reduce((acc, v) => acc + (v.confidence || 0), 0) / processedVisits.length * 100)
      : 0
    
    // Calculate confidence trend
    const recentConfidence = processedVisits.slice(0, 3).reduce((acc, v) => acc + (v.confidence || 0), 0) / Math.min(3, processedVisits.length) * 100
    const olderConfidence = processedVisits.slice(-3).reduce((acc, v) => acc + (v.confidence || 0), 0) / Math.min(3, processedVisits.length) * 100
    const confidenceTrend = recentConfidence - olderConfidence

    // Stage progression analysis
    const stageProgression = processedVisits.reduce((acc: any, visit) => {
      const stage = visit.predicted_class || 'Unknown'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})

    // Quality flags
    const lowConfidenceCount = processedVisits.filter(v => (v.confidence || 0) < 0.8).length
    const hasQualityIssues = lowConfidenceCount > 0

    // Time since last scan
    const daysSinceLastScan = visits.length > 0 
      ? Math.floor((Date.now() - new Date(visits[0].created_at!).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    return {
      avgConfidence,
      confidenceTrend,
      stageProgression,
      hasQualityIssues,
      lowConfidenceCount,
      daysSinceLastScan
    }
  }

  const metrics = calculatePatientMetrics()

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 animate-pulse">Loading patient data...</p>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Animated Header */}
      <div className="bg-gradient-to-r from-white/90 via-white/80 to-white/90 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4 hover:scale-105 transition-transform duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-6">
              <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {patient.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  {patient.name}
                </h1>
                <p className="text-gray-600 text-lg">
                  DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                </p>
                {patient.medical_record_number && (
                  <p className="text-gray-600">MRN: {patient.medical_record_number}</p>
                )}
              </div>
            </div>
            <Button 
              onClick={() => setShowUploadForm(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:scale-105 transition-all duration-300"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload MRI Scan
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {showUploadForm && (
          <Card className="mb-6 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30 hover:shadow-xl transition-all duration-500">
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

        {/* Patient Analytics KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <AnimatedMetricCard
            title="Total Visits"
            value={visits.length}
            description="MRI scans completed"
            icon={<Calendar className="h-4 w-4" />}
            delay={0}
          />
          
          <AnimatedMetricCard
            title="Avg Confidence"
            value={`${metrics.avgConfidence.toFixed(1)}%`}
            description="Analysis accuracy"
            icon={<TrendingUp className="h-4 w-4" />}
            trend={metrics.confidenceTrend > 5 ? 'up' : metrics.confidenceTrend < -5 ? 'down' : 'neutral'}
            trendValue={`${Math.abs(metrics.confidenceTrend).toFixed(1)}% trend`}
            delay={100}
          />

          <AnimatedMetricCard
            title="Days Since Last"
            value={metrics.daysSinceLastScan}
            description="Last scan date"
            icon={<Clock className="h-4 w-4" />}
            alert={metrics.daysSinceLastScan > 90}
            delay={200}
          />

          <AnimatedMetricCard
            title="Quality Issues"
            value={metrics.lowConfidenceCount}
            description="Low confidence scans"
            icon={<AlertTriangle className="h-4 w-4" />}
            alert={metrics.hasQualityIssues}
            delay={300}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Insights Panel with subtle parallax */}
          <div className="lg:col-span-2 will-change-transform transform-gpu hover:translate-y-[-2px] transition-transform duration-500">
            <InsightsPanel visits={visits} patientName={patient.name} />
          </div>

          <TrendChart
            data={chartData}
            title="Confidence Trend"
            description="Analysis confidence over time"
            gradient={true}
          />

          <Card className="hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30 hover:translate-y-[-4px]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2 text-green-500" />
                Visit Summary
              </CardTitle>
              <CardDescription>
                Overview of all MRI scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Total Visits:</span>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {visits.length}
                  </Badge>
                </div>
                {visits.length > 0 && (
                  <>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Latest Scan:</span>
                      <span className="font-semibold">
                        {new Date(visits[0].created_at!).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Current Status:</span>
                      <Badge className={getStageColor(visits[0].predicted_class)}>
                        {formatStage(visits[0].predicted_class)}
                      </Badge>
                    </div>
                    {visits[0].confidence && (
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">Confidence:</span>
                        <span className="font-semibold text-lg">
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

        {/* Stage-Specific Guidance with animation */}
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <StageGuidance latestVisit={visits[0] || null} patientName={patient.name} />
        </div>

        {/* Research & Export */}
        <div className="mb-6">
          <ResearchExport visits={visits} />
        </div>

        {/* Enhanced Visit History */}
        <Card className="hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30 hover:translate-y-[-3px]">
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
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">No MRI scans uploaded yet</p>
                <p className="text-sm text-gray-400 mb-6">Upload your first scan to get started with analysis</p>
                <Button 
                  onClick={() => setShowUploadForm(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Upload First Scan
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {visits.map((visit, index) => (
                  <div 
                    key={visit.id} 
                    className="flex items-center justify-between p-4 border rounded-xl hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-md animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-6">
                        <div className="text-sm font-medium text-gray-600 min-w-[80px]">
                          {new Date(visit.created_at!).toLocaleDateString()}
                        </div>
                        <Badge className={`${getStageColor(visit.predicted_class)} min-w-[140px] justify-center`}>
                          {formatStage(visit.predicted_class)}
                        </Badge>
                        {visit.confidence && (
                          <div className="text-sm font-semibold text-gray-700 min-w-[100px]">
                            {(visit.confidence * 100).toFixed(1)}% confidence
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPDF(visit)}
                      className="flex items-center space-x-2 hover:scale-105 transition-all duration-200"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download PDF</span>
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
