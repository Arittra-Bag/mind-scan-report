import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Upload, X, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, AlertVariant } from '@/components/ui/alert'

interface MriUploadFormProps {
  patientId: string
  onSuccess: () => void
  onCancel: () => void
}

const MriUploadForm = ({ patientId, onSuccess, onCancel }: MriUploadFormProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [notMri, setNotMri] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Reset state
      setNotMri(false)
      
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select a valid image file",
          variant: "destructive",
        })
        return
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 10MB",
          variant: "destructive",
        })
        return
      }
      
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      toast({
        title: "Error",
        description: "Please select an MRI image file",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setNotMri(false)

    try {
      // Get the current session for user ID
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call the API directly
      const apiFormData = new FormData()
      apiFormData.append('file', file)

      console.log('Sending request directly to HuggingFace API...')
      
      const apiResponse = await fetch('https://arittrabag-mri-h4b.hf.space/detect', {
        method: 'POST',
        body: apiFormData,
      })

      if (!apiResponse.ok) {
        throw new Error(`API call failed: ${apiResponse.status}`)
      }

      const apiResult = await apiResponse.json()
      console.log('API Response:', apiResult)

      // Process the response based on whether it's an MRI or not
      const isMRI = apiResult.isMRI === true
      const predictedClass = isMRI ? apiResult.dementiaAnalysis?.predictedClass : null
      
      // Calculate confidence value
      let confidence = null
      if (isMRI && apiResult.dementiaAnalysis?.confidences) {
        const confidenceValues = Object.values(apiResult.dementiaAnalysis.confidences) as number[]
        confidence = Math.max(...confidenceValues)
      } else if (!isMRI && typeof apiResult.mriConfidence === 'number') {
        confidence = apiResult.mriConfidence
      }
      
      // Map the predicted class to match database enum
      let dbPredictedClass = null
      if (isMRI && predictedClass) {
        const mappings = {
          "Non Demented": "Normal",
          "Very Mild Dementia": "Very_Mild_Dementia",
          "Mild Dementia": "Mild_Dementia", 
          "Moderate Dementia": "Moderate_Dementia"
        }
        dbPredictedClass = mappings[predictedClass] || predictedClass.replace(/\s+/g, '_')
      }

      // Save result to database
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          patient_id: patientId,
          raw_report: apiResult,
          predicted_class: dbPredictedClass,
          confidence: confidence,
          insights: isMRI ? apiResult.dementiaAnalysis?.insights : `Not an MRI scan. ${apiResult.message}`,
          created_by: session.user.id
        })
        .select()
        .single()

      if (visitError) {
        console.error('Database error:', visitError)
        throw new Error(`Failed to save visit data: ${visitError.message}`)
      }

      // Handle UI feedback based on MRI status
      if (!isMRI) {
        setNotMri(true)
        toast({
          title: "Not a Brain MRI",
          description: "The uploaded image is not recognized as a brain MRI scan. Record has been saved.",
          variant: "warning",
        })
      } else {
        toast({
          title: "Success",
          description: "MRI scan processed successfully!",
        })
      }

      onSuccess()
      
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to process MRI scan",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {notMri && (
        <Alert variant="warning" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not a Brain MRI</AlertTitle>
          <AlertDescription>
            The image you uploaded doesn't appear to be a Brain MRI scan. 
            Please try uploading a different image.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="mri-file">MRI Image File</Label>
        <Input
          id="mri-file"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={loading}
        />
        <p className="text-sm text-gray-500">
          Supported formats: JPG, PNG, GIF. Maximum size: 10MB
        </p>
      </div>

      {file && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-sm text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !file}
          className="flex-1"
        >
          {loading ? 'Processing...' : 'Upload & Analyze'}
        </Button>
      </div>
    </form>
  )
}

export default MriUploadForm
