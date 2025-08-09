
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft } from 'lucide-react'

const NewPatient = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    medicalRecordNumber: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          name: formData.name,
          date_of_birth: formData.dateOfBirth,
          medical_record_number: formData.medicalRecordNumber || null
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Success",
        description: "Patient created successfully!",
      })

      navigate(`/patients/${data.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Add New Patient</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
            <CardDescription>
              Enter the patient's basic information to create their profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  placeholder="Enter patient's full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicalRecordNumber">Medical Record Number</Label>
                <Input
                  id="medicalRecordNumber"
                  type="text"
                  value={formData.medicalRecordNumber}
                  onChange={(e) => handleInputChange('medicalRecordNumber', e.target.value)}
                  placeholder="Optional medical record number"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Patient'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default NewPatient
