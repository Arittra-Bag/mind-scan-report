# Mind Scan Report: BrainTech Extension

## Overview

Mind Scan Report is a specialized extension of the BrainTech platform, focused on advanced MRI brain scan analysis for dementia screening and diagnosis. This application leverages AI-powered image analysis to assist healthcare professionals in identifying and classifying cognitive conditions across various stages, from normal cognitive function to moderate dementia.

## Key Features

- **AI-Powered MRI Analysis**: Upload and analyze brain MRI scans with advanced AI models to detect signs of dementia
- **Multi-Stage Classification**: Identifies and classifies brain scans into Normal, Very Mild Dementia, Mild Dementia, or Moderate Dementia categories
- **Patient Management**: Complete patient profile management with medical history tracking
- **Visual Dashboard**: Interactive visualization of patient data and scan history
- **Professional PDF Reports**: Generate comprehensive medical reports with insights for clinical use
- **Secure Authentication**: Role-based access control for healthcare professionals

## Technology Stack

This project extends BrainTech using:

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL database, authentication, storage)
- **AI Integration**: HuggingFace API for MRI image analysis
- **PDF Generation**: jsPDF and html2canvas for professional medical reports

## Integration with HuggingFace AI

The application connects directly to a custom-trained AI model deployed on HuggingFace:
- Endpoint: `https://arittrabag-mri-h4b.hf.space/detect`
- Capabilities: MRI validation, dementia stage classification, confidence scoring, and personalized insights

### Using the MRI Analysis Feature

1. Create a patient profile
2. Upload an MRI scan image
3. The system will analyze the image and provide classification results
4. Download a professional PDF report for your medical records

## Data Structure

The application uses the following key database tables:
- `patients`: Patient information and demographics
- `visits`: MRI scan analysis results and insights
- `profiles`: Healthcare professional accounts and roles

## License

© 2025 BrainTech Extensions. All Rights Reserved.