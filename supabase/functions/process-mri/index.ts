
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const patientId = formData.get('patientId') as string

    if (!file) {
      throw new Error('No file provided')
    }

    if (!patientId) {
      throw new Error('No patient ID provided')
    }

    console.log(`Processing MRI for patient: ${patientId}`)
    console.log(`File details: ${file.name}, ${file.type}, ${file.size} bytes`)

    // Create a new FormData object for the API call
    const apiFormData = new FormData()
    
    // Pass the file directly to maintain proper encoding
    apiFormData.append('file', file, file.name)

    console.log('Sending request to MRI detection API...')

    // Call the MRI detection API with form-data (not JSON)
    const apiResponse = await fetch('https://arittrabag-mri-h4b.hf.space/detect', {
      method: 'POST',
      body: apiFormData, // Send as FormData, not JSON
    })

    console.log(`API Response status: ${apiResponse.status}`)

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error(`API Error: ${apiResponse.status} - ${errorText}`)
      throw new Error(`API call failed: ${apiResponse.status}`)
    }

    const apiResult = await apiResponse.json()
    console.log('API Response:', JSON.stringify(apiResult, null, 2))

    // Check if it's a valid MRI
    if (!apiResult.isMRI) {
      return new Response(
        JSON.stringify({ error: 'Invalid MRI scan' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract data from the API response - using correct field names
    const { dementiaAnalysis } = apiResult
    const predictedClass = dementiaAnalysis?.predictedClass || null
    
    // Calculate confidence as the maximum value from the confidences object
    let confidence = null
    if (dementiaAnalysis?.confidences) {
      const confidenceValues = Object.values(dementiaAnalysis.confidences) as number[]
      confidence = Math.max(...confidenceValues)
    }
    
    const insights = dementiaAnalysis?.insights || null

    console.log(`Extracted data - Class: ${predictedClass}, Confidence: ${confidence}`)

    // Save the visit to the database
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .insert({
        patient_id: patientId,
        raw_report: apiResult,
        predicted_class: predictedClass,
        confidence: confidence,
        insights: insights,
        created_by: user.id
      })
      .select()
      .single()

    if (visitError) {
      console.error('Database error:', visitError)
      throw new Error('Failed to save visit data')
    }

    console.log('Visit saved successfully:', visit.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        visit: visit,
        analysis: dementiaAnalysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing MRI:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
