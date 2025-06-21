import { useState, useEffect, useRef } from 'react'
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
      case 'Normal': return 'bg-green-100 text-green-800'
      case 'Very_Mild_Dementia': return 'bg-yellow-100 text-yellow-800'
      case 'Mild_Dementia': return 'bg-orange-100 text-orange-800'
      case 'Moderate_Dementia': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStage = (stage: string | null) => {
    if (!stage) return 'Processing...'
    return stage.replace(/_/g, ' ')
  }

  const downloadReport = async (visit: Visit) => {
    try {
      // Create a container for the report
      const reportContainer = document.createElement('div')
      reportContainer.style.padding = '20px'
      reportContainer.style.fontFamily = 'Arial, sans-serif'
      reportContainer.style.position = 'absolute'
      reportContainer.style.left = '-9999px'
      reportContainer.style.top = '-9999px'
      reportContainer.style.width = '550px' // Set fixed width for A4 portrait format
      document.body.appendChild(reportContainer)
      
      // Format date properly
      const scanDate = new Date(visit.created_at!).toLocaleDateString()
      const confidencePercent = visit.confidence ? (visit.confidence * 100).toFixed(1) + '%' : 'N/A'
      const dementialClass = formatStage(visit.predicted_class)
      
      // Create the report content with HTML
      reportContainer.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
          <h1 style="margin-bottom:5px;">Mind Scan Report</h1>
          <h2 style="margin-top:0; color:#555; font-weight:normal;">MRI Analysis Results</h2>
        </div>
        <div style="margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #eee;">
          <h3 style="margin-bottom:10px;">Patient Information</h3>
          <p><strong>Name:</strong> ${patient.name}</p>
          <p><strong>DOB:</strong> ${new Date(patient.date_of_birth).toLocaleDateString()}</p>
          ${patient.medical_record_number ? `<p><strong>MRN:</strong> ${patient.medical_record_number}</p>` : ''}
        </div>
        <div style="margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #eee;">
          <h3 style="margin-bottom:10px;">Scan Details</h3>
          <p><strong>Scan Date:</strong> ${scanDate}</p>
          <p><strong>Diagnosis:</strong> <span style="font-weight:bold; color:${getDiagnosisColor(visit.predicted_class)};">${dementialClass}</span></p>
          <p><strong>Confidence:</strong> ${confidencePercent}</p>
        </div>
      `
      
      // Add insights if available
      if (visit.insights) {
        reportContainer.innerHTML += `
          <div style="margin-bottom:20px;">
            <h3 style="margin-bottom:10px;">Analysis Insights</h3>
            <div style="white-space:pre-wrap; padding:10px; background-color:#f9f9f9; border-radius:5px; font-size:0.9em;">
              ${visit.insights.replace(/\n/g, '<br>')}
            </div>
          </div>
        `
      }
      
      // Add footer
      reportContainer.innerHTML += `
        <div style="margin-top:30px; text-align:center; font-size:0.8em; color:#777;">
          <p>This report was generated on ${new Date().toLocaleString()}.</p>
          <p>Mind Scan Analysis Platform. All rights reserved.</p>
        </div>
      `
      
      // Convert to PDF with html2canvas and jsPDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const canvas = await html2canvas(reportContainer, {
        scale: 2,
        logging: false,
        useCORS: true
      })
      
      // Add the image to the PDF
      const imgData = canvas.toDataURL('image/png')
      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      // If content is longer than one page, handle multiple pages
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
      
      // Create filename and save
      const filename = `mri-report-${patient.name.replace(/\s+/g, '-')}-${new Date(visit.created_at!).toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
      
      // Clean up
      document.body.removeChild(reportContainer)
      
      toast({
        title: "Success",
        description: "Report downloaded successfully",
      })
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      })
    }
  }
  
  // Helper function for diagnosis color in PDF
  const getDiagnosisColor = (stage: string | null) => {
    switch (stage) {
      case 'Normal': return '#16a34a' // green
      case 'Very_Mild_Dementia': return '#ca8a04' // yellow
      case 'Mild_Dementia': return '#ea580c' // orange
      case 'Moderate_Dementia': return '#dc2626' // red
      default: return '#6b7280' // gray
    }
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
