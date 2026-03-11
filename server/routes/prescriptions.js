const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const Prescription = require('../models/Prescription');
const Medication = require('../models/Medication');
const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up Multer for handling file uploads securely
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// AI Prompt ported from Python logic
const buildPrompt = () => {
    return `You are an expert medical prescription reader. Extract ALL information visible and return ONLY a valid JSON object. No markdown.
{
  "doctor": {
    "name": "Full name",
    "regNo": "Medical registration number",
    "clinic": "Clinic name",
    "date": "Date on prescription"
  },
  "patient": {
    "name": "Patient full name"
  },
  "medicines": [
    {
      "name": "Medicine name",
      "dosage": "Strength e.g. 500mg",
      "frequency": "How often e.g. twice daily",
      "duration": "How long e.g. 5 days",
      "route": "oral / topical"
    }
  ],
  "instructions": "General instructions"
}`;
};

// UPLOAD PIPELINE
router.post('/upload', auth, upload.single('prescription'), async (req, res) => {
  try {
    const { type } = req.body; // 'NEW' or 'OLD'
    const file = req.file;

    console.log('[Upload] Received upload request. Type:', type, 'File:', file?.originalname);

    if (!file) return res.status(400).json({ error: 'No image uploaded' });
    if (!type || !['NEW', 'OLD'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    // Step 1: Read image and format for Groq Vision
    const imageBytes = fs.readFileSync(file.path);
    const base64Image = imageBytes.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
    console.log('[Upload] Image loaded, size:', imageBytes.length, 'bytes. Calling Groq Vision...');

    // Step 2: Call Groq API
    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt() },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ]
    });

    const rawResponse = completion.choices[0].message.content || "";
    console.log('[Upload] Groq raw response:', rawResponse.substring(0, 300));
    const cleanJSON = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanJSON);

    // Step 3: Create Prescription Record
    const prescription = new Prescription({
      patientId: req.user.id,
      type: type,
      doctorRecognizedName: extractedData.doctor?.name || 'Unknown Doctor',
      doctorRegNo: extractedData.doctor?.regNo || null,
      date: extractedData.doctor?.date ? new Date(extractedData.doctor.date) : new Date(),
      imagePath: file.filename,
      rawOcrData: extractedData
    });
    
    await prescription.save();
    console.log('[Upload] Prescription saved:', prescription._id);

    // Step 4: Parse Medications and Calculate Reminder Times
    const medsToSave = [];
    if (extractedData.medicines && Array.isArray(extractedData.medicines)) {
      extractedData.medicines.forEach(med => {
        let reminders = [];
        const freqText = (med.frequency || '').toLowerCase();
        
        if (freqText.includes('once') && freqText.includes('night')) reminders = ['21:00'];
        else if (freqText.includes('once')) reminders = ['09:00'];
        else if (freqText.includes('twice')) reminders = ['09:00', '21:00'];
        else if (freqText.includes('thrice') || freqText.includes('tds')) reminders = ['08:00', '14:00', '20:00'];
        else if (freqText.includes('four')) reminders = ['08:00', '12:00', '16:00', '20:00'];

        medsToSave.push({
          prescriptionId: prescription._id,
          patientId: req.user.id,
          name: med.name || 'Unknown',
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          duration: med.duration || '',
          reminderTimes: reminders,
          status: type === 'NEW' ? 'ACTIVE' : 'HISTORY',
          isManual: false
        });
      });

      if (medsToSave.length > 0) {
        await Medication.insertMany(medsToSave);
      }
    }
    console.log('[Upload] Medications saved:', medsToSave.length);

    res.json({ 
      success: true, 
      prescriptionId: prescription._id, 
      extractedData, 
      medicinesAdded: medsToSave.length 
    });

  } catch (err) {
    console.error('OCR Error:', err.message);
    console.error('Full error:', err.stack || err);
    res.status(500).json({ error: 'Failed to process prescription: ' + err.message });
  }
});

module.exports = router;
