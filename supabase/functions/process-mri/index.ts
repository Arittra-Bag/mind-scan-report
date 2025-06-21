import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Define the valid dementia stage enum values
const VALID_DEMENTIA_STAGES = [
  "Normal",
  "Very_Mild_Dementia", 
  "Mild_Dementia", 
  "Moderate_Dementia"
];

// Function to map API response to valid enum values
function mapToDementiaStage(apiClass: string): string | null {
  if (!apiClass) return null;
  
  // Direct mapping for API-returned classes to database enum values
  const mappings: Record<string, string> = {
    "Non Demented": "Normal",
    "Very Mild Dementia": "Very_Mild_Dementia",
    "Mild Dementia": "Mild_Dementia", 
    "Moderate Dementia": "Moderate_Dementia"
  };
  
  // Check for exact match in our mapping
  if (apiClass in mappings) {
    return mappings[apiClass];
  }
  
  // Fallback to fuzzy matching if no exact match
  const normalized = apiClass.replace(/\s+/g, '_').toLowerCase();
  
  for (const validStage of VALID_DEMENTIA_STAGES) {
    if (normalized.includes(validStage.toLowerCase().replace(/_/g, '')) || 
        validStage.toLowerCase().replace(/_/g, '').includes(normalized)) {
      return validStage;
    }
  }
  
  // Final fallback for common cases
  if (normalized.includes('normal') || normalized.includes('non')) return 'Normal';
  if (normalized.includes('verymild') || normalized.includes('very_mild')) return 'Very_Mild_Dementia';
  if (normalized.includes('mild') && !normalized.includes('very')) return 'Mild_Dementia';
  if (normalized.includes('moderate')) return 'Moderate_Dementia';
  
  // Default case if no match found
  console.warn(`Could not map "${apiClass}" to a valid dementia stage`);
  return null;
}

// Function to personalize insights if possible
function personalizeInsights(insights: string | null, patientName: string | null): string | null {
  if (!insights || !patientName) return insights;
  
  // Add a personalized header
  return `Patient Analysis for ${patientName}\n\n${insights}`;
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

    // Fetch patient data for personalization
    const { data: patientData } = await supabase
      .from('patients')
      .select('name')
      .eq('id', patientId)
      .single();

    const patientName = patientData?.name || null;

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

    // Extract common info
    const isMRI = apiResult.isMRI;
    const status = apiResult.status;
    const message = apiResult.message || '';

    // Check if it's a valid MRI
    if (!isMRI || status === 'not_mri') {
      // For non-MRI images, we'll still save a record but with different data
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          patient_id: patientId,
          raw_report: apiResult,
          predicted_class: null, // No dementia prediction for non-MRI
          confidence: apiResult.mriConfidence, // Use the MRI confidence
          insights: `Not an MRI scan. ${message}`,
          created_by: user.id
        })
        .select()
        .single();

      if (visitError) {
        console.error('Database error details:', {
          message: visitError.message,
          details: visitError.details,
          hint: visitError.hint,
          code: visitError.code
        });
        throw new Error(`Failed to save visit data for non-MRI: ${visitError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          visit: visit,
          isValid: false,
          message: "Invalid MRI scan. Record saved."
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract data from the API response for valid MRIs
    const { dementiaAnalysis } = apiResult;
    
    if (!dementiaAnalysis) {
      throw new Error('Missing dementia analysis data in API response');
    }
    
    const rawPredictedClass = dementiaAnalysis.predictedClass || null;
    
    // Map the API's predicted class to a valid enum value
    const predictedClass = mapToDementiaStage(rawPredictedClass);
    console.log(`Mapping predicted class from "${rawPredictedClass}" to "${predictedClass}"`);
    
    // Calculate confidence as the maximum value from the confidences object
    let confidence = null;
    if (dementiaAnalysis.confidences) {
      const confidenceValues = Object.values(dementiaAnalysis.confidences) as number[];
      const maxConfidence = Math.max(...confidenceValues);
      
      // Ensure confidence is between 0 and 1 with at most 4 decimal places
      if (!isNaN(maxConfidence) && isFinite(maxConfidence)) {
        // Clamp to 0-1 range
        const clampedValue = Math.max(0, Math.min(1, maxConfidence));
        // Format to 4 decimal places maximum
        confidence = parseFloat(clampedValue.toFixed(4));
        console.log(`Formatted confidence from ${maxConfidence} to ${confidence}`);
      } else {
        console.warn(`Invalid confidence value: ${maxConfidence}`);
      }
    }
    
    // Personalize insights if possible
    let insights = dementiaAnalysis.insights || null;
    insights = personalizeInsights(insights, patientName);

    console.log(`Extracted data - Class: ${predictedClass}, Confidence: ${confidence}`);

    // Prepare the visit data
    const visitData = {
      patient_id: patientId,
      raw_report: apiResult,
      predicted_class: predictedClass,
      confidence: confidence,
      insights: insights,
      created_by: user.id
    };

    console.log('Saving visit data:', JSON.stringify(visitData, null, 2));

    // Save the visit to the database
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .insert(visitData)
      .select()
      .single();

    if (visitError) {
      // Log detailed error information
      console.error('Database error details:', {
        message: visitError.message,
        details: visitError.details,
        hint: visitError.hint,
        code: visitError.code
      });
      
      // Check for specific error types
      if (visitError.code === '23503') {
        throw new Error('Failed to save visit: Foreign key constraint violation. Invalid patient ID.');
      } else if (visitError.code === '23502') {
        throw new Error('Failed to save visit: Not-null constraint violation.');
      } else if (visitError.code === '22P02') {
        throw new Error('Failed to save visit: Invalid enum value for predicted_class.');
      } else {
        throw new Error(`Failed to save visit data: ${visitError.message}`);
      }
    }

    console.log('Visit saved successfully:', visit.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        visit: visit,
        analysis: dementiaAnalysis,
        isValid: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing MRI:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
