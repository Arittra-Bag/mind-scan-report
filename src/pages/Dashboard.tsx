
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, FileText, Clock, TrendingUp, AlertTriangle, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Tables } from '@/integrations/supabase/types'
import AnimatedMetricCard from '@/components/AnimatedMetricCard'
import TrendChart from '@/components/TrendChart'
import StageDistributionChart from '@/components/StageDistributionChart'
import { toast } from '@/hooks/use-toast'

type Patient = Tables<'patients'>
type Visit = Tables<'visits'>

const Dashboard = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [recentVisits, setRecentVisits] = useState<(Visit & { patient: Patient })[]>([])
  const [allVisits, setAllVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })

      if (patientsError) throw patientsError

      // Fetch recent visits with patient info
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients(*)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (visitsError) throw visitsError

      // Fetch all visits for analytics
      const { data: allVisitsData, error: allVisitsError } = await supabase
        .from('visits')
        .select('*')
        .order('created_at', { ascending: false })

      if (allVisitsError) throw allVisitsError

      setPatients(patientsData || [])
      setRecentVisits(visitsData || [])
      setAllVisits(allVisitsData || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Business metrics calculations
  const calculateMetrics = () => {
    const processedVisits = allVisits.filter(v => v.predicted_class && v.confidence)
    const totalScans = allVisits.length
    const avgConfidence = processedVisits.length > 0 
      ? (processedVisits.reduce((acc, v) => acc + (v.confidence || 0), 0) / processedVisits.length * 100)
      : 0
    
    // Calculate stage distribution
    const stageDistribution = processedVisits.reduce((acc: any, visit) => {
      const stage = visit.predicted_class || 'Unknown'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})

    const stageData = Object.entries(stageDistribution).map(([stage, count]) => ({
      stage,
      count: count as number,
      percentage: ((count as number) / processedVisits.length) * 100
    }))

    // Alert conditions
    const lowConfidenceScans = processedVisits.filter(v => (v.confidence || 0) < 0.8).length
    const hasAlerts = lowConfidenceScans > 0

    // Weekly scan trend
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    const weeklyScans = allVisits.filter(v => new Date(v.created_at!) > lastWeek).length
    const prevWeekStart = new Date(lastWeek)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeeklyScans = allVisits.filter(v => {
      const date = new Date(v.created_at!)
      return date > prevWeekStart && date <= lastWeek
    }).length
    
    const weeklyTrend = prevWeeklyScans > 0 
      ? ((weeklyScans - prevWeeklyScans) / prevWeeklyScans * 100)
      : weeklyScans > 0 ? 100 : 0

    return {
      totalScans,
      avgConfidence,
      stageData,
      hasAlerts,
      lowConfidenceScans,
      weeklyScans,
      weeklyTrend
    }
  }

  const metrics = calculateMetrics()

  const exportCSV = () => {
    const csvData = allVisits.map(visit => ({
      Date: new Date(visit.created_at!).toLocaleDateString(),
      PatientID: visit.patient_id,
      Stage: visit.predicted_class || 'Processing',
      Confidence: visit.confidence ? (visit.confidence * 100).toFixed(1) + '%' : 'N/A',
      ProcessingTime: 'N/A' // We'll add this later
    }))

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mri-analysis-data.csv'
    a.click()
    
    toast({
      title: "Export Complete",
      description: "Data exported successfully"
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Animated header with parallax effect */}
      <div className="relative bg-gradient-to-r from-white/90 via-white/80 to-white/90 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-pink-600/10 animate-pulse"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                MRI Analysis Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={exportCSV}
                className="hover:scale-105 transition-transform duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <span className="text-gray-600">Welcome, {user?.email}</span>
              <Button 
                variant="outline" 
                onClick={signOut}
                className="hover:scale-105 transition-transform duration-200"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Animated KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <AnimatedMetricCard
            title="Total Patients"
            value={patients.length}
            description="Active patients"
            icon={<Users className="h-4 w-4" />}
            delay={0}
          />
          
          <AnimatedMetricCard
            title="Total Scans"
            value={metrics.totalScans}
            description="MRI analyses completed"
            icon={<FileText className="h-4 w-4" />}
            trend={metrics.weeklyTrend > 0 ? 'up' : metrics.weeklyTrend < 0 ? 'down' : 'neutral'}
            trendValue={`${Math.abs(metrics.weeklyTrend).toFixed(1)}% this week`}
            delay={100}
          />

          <AnimatedMetricCard
            title="Avg Confidence"
            value={`${metrics.avgConfidence.toFixed(1)}%`}
            description="Analysis accuracy"
            icon={<TrendingUp className="h-4 w-4" />}
            trend={metrics.avgConfidence > 85 ? 'up' : metrics.avgConfidence < 70 ? 'down' : 'neutral'}
            delay={200}
          />

          <AnimatedMetricCard
            title="Quality Alerts"
            value={metrics.lowConfidenceScans}
            description="Scans needing review"
            icon={<AlertTriangle className="h-4 w-4" />}
            alert={metrics.hasAlerts}
            delay={300}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <TrendChart 
              data={recentVisits
                .filter(visit => visit.confidence !== null)
                .map((visit, index) => ({
                  visit: `Visit ${recentVisits.length - index}`,
                  confidence: visit.confidence ? visit.confidence * 100 : 0,
                  date: new Date(visit.created_at!).toLocaleDateString(),
                  stage: visit.predicted_class?.replace(/_/g, ' ') || 'Processing'
                }))
                .reverse()}
              gradient={true}
            />
          </div>
          
          <StageDistributionChart data={metrics.stageData} />
        </div>

        {/* Enhanced Recent Data Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2 text-blue-500" />
                Recent Patients
              </CardTitle>
              <CardDescription>Recently added patients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patients.slice(0, 5).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No patients found</p>
                  </div>
                ) : (
                  patients.slice(0, 5).map((patient, index) => (
                    <div 
                      key={patient.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-all duration-300 hover:scale-105 animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-gray-500">
                            DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-green-500" />
                Recent Scans
              </CardTitle>
              <CardDescription>Latest MRI scan results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentVisits.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No scans found</p>
                  </div>
                ) : (
                  recentVisits.map((visit, index) => (
                    <div 
                      key={visit.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-all duration-300 hover:scale-105 animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                          <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{visit.patient?.name}</p>
                          <p className="text-sm text-gray-500">
                            {visit.predicted_class?.replace(/_/g, ' ') || 'Processing...'} 
                            {visit.confidence && ` (${(visit.confidence * 100).toFixed(1)}%)`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(visit.created_at!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/patients/${visit.patient_id}`)}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Floating Button */}
        <div className="fixed bottom-8 right-8">
          <Button
            onClick={() => navigate('/patients/new')}
            className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-2xl hover:scale-110 transition-all duration-300"
            size="lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
