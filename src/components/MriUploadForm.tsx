
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Upload, X } from 'lucide-react'

interface MriUploadFormProps {
  patientId: string
  onSuccess: () => void
  onCancel: () => void
}

const MriUploadForm = ({ patientId, onSuccess, onCancel }: MriUploadFormProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
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

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Create FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('patientId', patientId)

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('process-mri', {
        body: formData,
      })

      if (error) throw error

      if (data.error) {
        throw new Error(data.error)
      }

      toast({
        title: "Success",
        description: "MRI scan processed successfully!",
      })

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
