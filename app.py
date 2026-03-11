"""
MediScribe - Doctor Handwritten Prescription Detection System
============================================================
Mini Project | Python Flask + Groq Vision API

This is the main Flask application file. It handles:
  - Serving the frontend HTML page
  - Receiving uploaded prescription images from the browser
  - Sending the image to Groq's Vision API for analysis
  - Returning the structured extracted data back to the browser as JSON
"""

import os
import base64
import json
from flask import Flask, render_template, request, jsonify
from groq import Groq
from pymongo import MongoClient
import datetime
import certifi

# ──────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────

# 🔑 Paste your Groq API key here
GROQ_API_KEY = "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"

# 🔑 MongoDB Connection String
MONGO_URI = "mongodb+srv://yadumithra1_db_user:yadumithra210@cluster0.thg6tib.mongodb.net/?appName=Cluster0"

# Allowed image types for upload validation
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

# Maximum upload size: 10 MB
MAX_CONTENT_LENGTH = 10 * 1024 * 1024


# ──────────────────────────────────────────────
# FLASK APP SETUP
# ──────────────────────────────────────────────

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# Initialize the Groq client with API key
client = Groq(api_key=GROQ_API_KEY)

# Initialize MongoDB client
mongo_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = mongo_client["mediscribe"]
prescriptions_collection = db["prescriptions"]

# Vision-capable model on Groq
MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct"


# ──────────────────────────────────────────────
# HELPER FUNCTIONS
# ──────────────────────────────────────────────

def allowed_file(filename):
    """
    Check if the uploaded file has an allowed image extension.
    Returns True if extension is in ALLOWED_EXTENSIONS, else False.
    """
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def bytes_to_data_url(file_bytes, mimetype):
    """
    Convert raw image bytes to a base64 data URL for Groq vision input.

    Args:
        file_bytes: Raw bytes of the uploaded image
        mimetype: MIME type string e.g. 'image/jpeg'

    Returns:
        str: Data URL string containing base64 image
    """
    media_type = mimetype or "image/jpeg"
    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{media_type};base64,{b64_data}"


def build_extraction_prompt():
    """
    Build the detailed prompt instructing the model exactly what to extract
    from the prescription image and how to format the output.

    The prompt requests JSON output with four main sections:
      1. doctor    - Doctor's name, qualifications, clinic, date, reg number
      2. patient   - Patient name, age, gender, contact
      3. medicines - List of medicines with dosage, frequency, duration, etc.
      4. instructions - General instructions, diet, follow-up, warnings

    Returns:
        str: The complete prompt string
    """
    return """You are an expert medical prescription reader with years of experience 
deciphering handwritten prescriptions. Carefully analyze this prescription image.

Extract ALL information visible and return ONLY a valid JSON object.
Do NOT include any markdown formatting, code fences, or extra text.
Respond with pure JSON only.

Use this exact structure:
{
  "doctor": {
    "name": "Full doctor name with title, or null if not found",
    "qualification": "Degrees and specialization e.g. MBBS, MD, or null",
    "clinic": "Clinic or hospital name, or null",
    "date": "Date on prescription e.g. 12/05/2024, or null",
    "regNo": "Medical registration number, or null"
  },
  "patient": {
    "name": "Patient full name, or null",
    "age": "Age with unit e.g. 28 years, or null",
    "gender": "Male / Female / Other, or null",
    "contact": "Phone number or address if present, or null"
  },
  "medicines": [
    {
      "name": "Medicine/drug name",
      "dosage": "Strength e.g. 500mg, 10ml, or null",
      "frequency": "How often e.g. twice daily, TDS, or null",
      "duration": "How long e.g. 5 days, 1 week, or null",
      "route": "oral / topical / injection / inhaler, or null",
      "notes": "Special instructions e.g. after food, or null"
    }
  ],
  "instructions": {
    "general": "Overall instructions for the patient, or null",
    "diet": "Diet recommendations or restrictions, or null",
    "followUp": "Follow-up date or next visit instruction, or null",
    "warnings": "Any important warnings or side effect notes, or null"
  },
  "confidence": "high if handwriting is clear / medium if partially readable / low if very hard to read",
  "readabilityNotes": "Note any parts that were unclear or ambiguous, or null"
}

Important:
- If a field is not present or not readable, use null (not empty string)
- medicines must always be an array, even if only one medicine
- Be thorough - capture every medicine listed"""


def call_groq_vision(image_data_url):
    """
    Send the prescription image to Groq's Vision API and get extraction results.

    Args:
        image_data_url: Base64 data URL containing the uploaded image

    Returns:
        dict: Parsed JSON result from Groq

    Raises:
        ValueError: If the model response cannot be parsed as JSON
        Exception: If the API call fails
    """
    prompt = build_extraction_prompt()

    response = client.chat.completions.create(
        model=MODEL_NAME,
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_url},
                    },
                ],
            }
        ],
    )

    raw_response = response.choices[0].message.content or ""
    clean_response = raw_response.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_response)


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.route("/")
def index():
    """
    Root route — serves the main HTML frontend page.
    The HTML template is in templates/index.html
    """
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    POST /analyze — Main API endpoint for prescription analysis.

    Workflow:
      1. Receive uploaded image file from the browser form
      2. Validate the file type
      3. Convert image to base64
      4. Send to Groq Vision API
      5. Return extracted data as JSON to the browser

    Returns:
        JSON response with either:
          - { success: true, data: { doctor, patient, medicines, instructions, ... } }
          - { success: false, error: "error message" }
    """

    # ── Step 1: Check a file was actually uploaded ──
    if "prescription" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded. Please select a prescription image."}), 400

    file = request.files["prescription"]

    # ── Step 2: Check the file is not empty ──
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected."}), 400

    # ── Step 3: Validate file type ──
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid file type. Please upload a JPG, PNG, or WEBP image."}), 400

    # ── Step 4: Read file bytes and convert to data URL ──
    try:
        file_bytes = file.read()
        image_data_url = bytes_to_data_url(file_bytes, file.mimetype)

        # ── Step 5: Call Groq Vision API ──
        result = call_groq_vision(image_data_url)
        
        # ── Step 5.5: Save to MongoDB ──
        # Add a timestamp so we know when it was uploaded
        prescription_doc = {
            "uploaded_at": datetime.datetime.utcnow(),
            "extracted_data": result
        }
        inserted_id = prescriptions_collection.insert_one(prescription_doc).inserted_id
        
        # Add the string representation of the inserted ID to the result
        result["_id"] = str(inserted_id)

    except Exception as err:
        # Return a clean API error to the frontend instead of a traceback page.
        return jsonify({"success": False, "error": f"Analysis failed: {err}"}), 500

    # ── Step 6: Return success response ──
    return jsonify({"success": True, "data": result})


@app.route("/api/prescriptions", methods=["GET"])
def get_prescriptions():
    """
    GET /api/prescriptions — Fetch all historical prescriptions.
    Returns:
        JSON response with the list of prescriptions.
    """
    try:
        # Fetch all prescriptions
        cursor = prescriptions_collection.find().sort("uploaded_at", -1)
        
        prescriptions = []
        for doc in cursor:
            # Convert ObjectId and datetime to string for JSON serialization
            doc["_id"] = str(doc["_id"])
            doc["uploaded_at"] = doc["uploaded_at"].isoformat()
            prescriptions.append(doc)
            
        return jsonify({"success": True, "data": prescriptions})
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to fetch prescriptions: {err}"}), 500


# ──────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  MediScribe - Prescription Detection System")
    print("  Running at: http://127.0.0.1:5000")
    print("=" * 50)

    # debug=True enables auto-reload on code changes
    # Set debug=False for production use
    app.run(debug=True, port=5000)
