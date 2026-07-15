import os
from PIL import Image, ImageDraw

def create_text_file(text_lines, filename, is_pdf=False):
    # Create white canvas
    img = Image.new("RGB", (700, 900), "white")
    draw = ImageDraw.Draw(img)
    
    # Draw clinical style border
    draw.rectangle([15, 15, 685, 885], outline="#0f766e", width=4)
    draw.rectangle([30, 30, 670, 120], fill="#0f766e")
    
    # Clinical Header
    draw.text((50, 60), "MEDGUARD HEALTHCARE NETWORK", fill="white")
    draw.text((50, 85), "Clinical Records & Assessment Center", fill="#cbd5e1")
    
    # Draw text lines
    y = 180
    for line in text_lines:
        draw.text((60, y), line, fill="black")
        y += 35
        
    # Draw bottom disclaimer
    draw.rectangle([30, 800, 670, 860], fill="#f8fafc", outline="#e2e8f0")
    draw.text((50, 825), "CONFIDENTIAL - For Patient & Clinician Use Only", fill="#64748b")
    
    if is_pdf:
        img.save(filename, "PDF")
    else:
        img.save(filename, "PNG")
    print(f"Generated {filename}")

def main():
    os.makedirs("samples", exist_ok=True)
    
    # 1. Prescription Glycomet High Confidence
    create_text_file([
        "PRESCRIPTION RECORD",
        "-------------------",
        "Patient: John Doe",
        "Date: 2026-07-15",
        "Doctor: Dr. Ramesh Kumar",
        "Clinic: City Diabetes Center",
        "",
        "Rx:",
        "  Glycomet 500mg",
        "  Quantity: 30 tablets",
        "  Frequency: Once daily",
        "  Duration: 30 days",
        "",
        "Instructions: Take with dinner."
    ], "samples/prescription_glycomet_high_confidence.png")
    
    # 2. Prescription Crocin Low Confidence
    create_text_file([
        "PRESCRIPTION RECORD",
        "-------------------",
        "Patient: John Doe",
        "Date: 2026-07-15",
        "Doctor: Dr. Ramesh Kumar",
        "Clinic: City General Clinic",
        "",
        "Rx:",
        "  Croc1n 650mg",
        "  Quantity: 15 tablets",
        "  Frequency: Three times daily",
        "  Duration: 5 days",
        "",
        "Instructions: Take after meals."
    ], "samples/prescription_crocin_low_confidence.png")
    
    # 3. Prescription Date Proximity
    # Using a visit date that matches today's test date (2026-07-15)
    create_text_file([
        "PRESCRIPTION RECORD (PROXIMITY TEST)",
        "------------------------------------",
        "Patient: John Doe",
        "Date: 2026-07-15",
        "Doctor: Dr. Ramesh Kumar",
        "Clinic: Proximity Cardiology Center",
        "",
        "Rx:",
        "  Lipitor 10mg",
        "  Quantity: 30 tablets",
        "  Frequency: Once daily at bedtime",
        "  Duration: 30 days",
    ], "samples/prescription_date_proximity.png")

    # 4. Lab Report TSH Normal
    create_text_file([
        "CLINICAL LABORATORY REPORT",
        "--------------------------",
        "Patient: John Doe",
        "Report Date: 2026-07-15",
        "Ordering Clinician: Dr. Ramesh Kumar",
        "Panel Name: Thyroid Profile",
        "",
        "Test Details:",
        "  Test Type: TSH",
        "  Measured Value: 3.4",
        "  Reference Unit: uIU/mL",
        "  Normal Range: 0.40 - 4.50",
        "",
        "Interpretation: Thyroid Stimulating Hormone level is normal."
    ], "samples/lab_report_tsh_normal.png")

    # 5. Lab Report HbA1c Elevated (PDF)
    create_text_file([
        "CLINICAL LABORATORY REPORT (ELEVATED GLYCEMIC)",
        "----------------------------------------------",
        "Patient: John Doe",
        "Report Date: 2026-07-15",
        "Ordering Clinician: Dr. Ramesh Kumar",
        "Panel Name: Complete Glycation Panel",
        "",
        "Test Details:",
        "  Test Type: Hb A1c",
        "  Measured Value: 7.2",
        "  Reference Unit: %",
        "  Normal Range: 4.0 - 5.6",
        "",
        "Interpretation: Glycated Hemoglobin level indicates elevated glycemic control."
    ], "samples/lab_report_hba1c_elevated.pdf", is_pdf=True)

    # 6. Prescription Past August (PDF)
    create_text_file([
        "PRESCRIPTION RECORD (HISTORIC RECORD)",
        "-------------------------------------",
        "Patient: John Doe",
        "Date: 2026-08-10",
        "Doctor: Dr. Ramesh Kumar",
        "Clinic: City General Clinic",
        "",
        "Rx:",
        "  Amoxil 500mg",
        "  Quantity: 21 capsules",
        "  Frequency: Three times daily",
        "  Duration: 7 days",
    ], "samples/prescription_past_august.pdf", is_pdf=True)

if __name__ == "__main__":
    main()
