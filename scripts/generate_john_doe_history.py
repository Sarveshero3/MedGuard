#!/usr/bin/env python3
"""
generate_john_doe_history.py — MedGuard Agentic Test Case Generator

Creates high-resolution synthetic clinical document images for
the "John Doe" end-to-end testing scenario.

Output:
  samples/1.png   — Prescription: Glycomet 500mg + Coumadin 5mg
  samples/2a.png  — Prescription: Disprn 325mg (ambiguous aspirin spelling)
  samples/2b.png  — Lab report: HbA1c 7.2%, Creatinine 1.1, K+ 4.2
  samples/3.png   — Follow-up lab: HbA1c 7.6%, Creatinine 1.5, K+ 5.3

Usage:
  pip install Pillow
  python scripts/generate_john_doe_history.py
"""

import os
from PIL import Image, ImageDraw, ImageFont
from datetime import date, timedelta

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), '..', 'samples')
os.makedirs(SAMPLES_DIR, exist_ok=True)

# Use a basic font; Pillow's default if system fonts unavailable
try:
    FONT_TITLE = ImageFont.truetype("arial.ttf", 36)
    FONT_HEADER = ImageFont.truetype("arial.ttf", 24)
    FONT_BODY = ImageFont.truetype("arial.ttf", 20)
    FONT_SMALL = ImageFont.truetype("arial.ttf", 16)
except OSError:
    FONT_TITLE = ImageFont.load_default()
    FONT_HEADER = FONT_TITLE
    FONT_BODY = FONT_TITLE
    FONT_SMALL = FONT_TITLE


def draw_prescription(filename, hospital, doctor, specialty, date_str, medicines, notes=""):
    """Generates a realistic prescription image."""
    img = Image.new('RGB', (900, 1200), '#FFFFFF')
    draw = ImageDraw.Draw(img)

    # Header bar
    draw.rectangle([(0, 0), (900, 80)], fill='#0F766E')
    draw.text((30, 20), hospital, fill='white', font=FONT_TITLE)

    # Doctor info
    y = 100
    draw.text((30, y), f"Dr. {doctor}", fill='#1a1a1a', font=FONT_HEADER)
    y += 35
    draw.text((30, y), specialty, fill='#666666', font=FONT_BODY)
    draw.text((600, y), f"Date: {date_str}", fill='#666666', font=FONT_BODY)

    # Divider
    y += 50
    draw.line([(30, y), (870, y)], fill='#cccccc', width=2)

    # Patient info
    y += 20
    draw.text((30, y), "Patient: John Doe", fill='#1a1a1a', font=FONT_BODY)
    y += 30
    draw.text((30, y), "Age: 62 years  |  Gender: Male", fill='#666666', font=FONT_SMALL)

    # Rx header
    y += 50
    draw.text((30, y), "Rx", fill='#0F766E', font=FONT_TITLE)
    y += 55

    # Medicines
    for i, med in enumerate(medicines, 1):
        draw.text((60, y), f"{i}. {med['name']}  —  {med['dosage']}", fill='#1a1a1a', font=FONT_BODY)
        y += 30
        draw.text((80, y), f"Frequency: {med['frequency']}", fill='#555555', font=FONT_SMALL)
        y += 25
        draw.text((80, y), f"Duration: {med['duration']}", fill='#555555', font=FONT_SMALL)
        y += 40

    # Notes
    if notes:
        y += 10
        draw.line([(30, y), (870, y)], fill='#cccccc', width=1)
        y += 15
        draw.text((30, y), "Clinical Notes:", fill='#1a1a1a', font=FONT_BODY)
        y += 30
        draw.text((50, y), notes, fill='#555555', font=FONT_SMALL)

    # Footer
    draw.rectangle([(0, 1150), (900, 1200)], fill='#f5f5f5')
    draw.text((30, 1160), f"Signature: Dr. {doctor}", fill='#999999', font=FONT_SMALL)
    draw.text((550, 1160), "Reg. No: MCI/12345", fill='#999999', font=FONT_SMALL)

    path = os.path.join(SAMPLES_DIR, filename)
    img.save(path, 'PNG')
    print(f"  [OK] Created {path}")


def draw_lab_report(filename, lab_name, date_str, values, patient_note=""):
    """Generates a realistic lab report image."""
    img = Image.new('RGB', (900, 1200), '#FFFFFF')
    draw = ImageDraw.Draw(img)

    # Header
    draw.rectangle([(0, 0), (900, 80)], fill='#1e3a5f')
    draw.text((30, 20), lab_name, fill='white', font=FONT_TITLE)

    y = 100
    draw.text((30, y), "Clinical Laboratory Report", fill='#1a1a1a', font=FONT_HEADER)
    y += 35
    draw.text((30, y), f"Report Date: {date_str}", fill='#666666', font=FONT_BODY)
    draw.text((500, y), "Patient: John Doe, 62M", fill='#666666', font=FONT_BODY)

    # Divider
    y += 50
    draw.line([(30, y), (870, y)], fill='#cccccc', width=2)

    # Table header
    y += 15
    draw.rectangle([(30, y), (870, y + 35)], fill='#f0f0f0')
    draw.text((40, y + 5), "Test", fill='#333333', font=FONT_BODY)
    draw.text((350, y + 5), "Value", fill='#333333', font=FONT_BODY)
    draw.text((530, y + 5), "Unit", fill='#333333', font=FONT_BODY)
    draw.text((700, y + 5), "Ref. Range", fill='#333333', font=FONT_BODY)

    y += 45
    for val in values:
        draw.text((40, y), val['test'], fill='#1a1a1a', font=FONT_BODY)
        draw.text((350, y), str(val['value']), fill='#1a1a1a', font=FONT_BODY)
        draw.text((530, y), val['unit'], fill='#666666', font=FONT_BODY)
        draw.text((700, y), val['ref'], fill='#666666', font=FONT_BODY)
        y += 35
        draw.line([(30, y), (870, y)], fill='#eeeeee', width=1)
        y += 10

    if patient_note:
        y += 20
        draw.text((30, y), "Note:", fill='#1a1a1a', font=FONT_BODY)
        y += 30
        draw.text((50, y), patient_note, fill='#555555', font=FONT_SMALL)

    # Footer
    draw.rectangle([(0, 1150), (900, 1200)], fill='#f5f5f5')
    draw.text((30, 1160), "Pathologist: Dr. R. Menon, MD Pathology", fill='#999999', font=FONT_SMALL)

    path = os.path.join(SAMPLES_DIR, filename)
    img.save(path, 'PNG')
    print(f"  [OK] Created {path}")


def main():
    today = date.today()
    visit1_date = (today - timedelta(days=30)).strftime("%d/%m/%Y")
    visit2_date = (today - timedelta(days=14)).strftime("%d/%m/%Y")
    lab1_date = (today - timedelta(days=14)).strftime("%d/%m/%Y")
    lab2_date = today.strftime("%d/%m/%Y")

    print("\nMedGuard - John Doe Test Case Generator\n")

    # 1. Prescription 1: Glycomet + Coumadin
    draw_prescription(
        "1.png",
        hospital="Apollo Sugar Clinics",
        doctor="A. K. Shastri",
        specialty="Endocrinology & Diabetology",
        date_str=visit1_date,
        medicines=[
            {"name": "Glycomet 500mg", "dosage": "500mg tablets", "frequency": "Twice daily after meals", "duration": "30 days"},
            {"name": "Coumadin 5mg", "dosage": "5mg tablets", "frequency": "Once daily at bedtime", "duration": "ongoing"},
        ],
        notes="Continue Metformin. Monitor INR weekly for Warfarin."
    )

    # 2a. Prescription 2: Disprn (ambiguous Aspirin)
    draw_prescription(
        "2a.png",
        hospital="Fortis Escorts Heart Institute",
        doctor="Sanjay Gupta",
        specialty="Cardiology",
        date_str=visit2_date,
        medicines=[
            {"name": "Disprn 325mg", "dosage": "325mg tablets", "frequency": "Once daily after breakfast", "duration": "14 days"},
        ],
        notes="Low-dose Aspirin for cardiac prophylaxis. Review in 2 weeks."
    )

    # 2b. Lab Report 1: Baseline values
    draw_lab_report(
        "2b.png",
        lab_name="SRL Diagnostics",
        date_str=lab1_date,
        values=[
            {"test": "HbA1c", "value": "7.2", "unit": "%", "ref": "4.0 - 5.6"},
            {"test": "Creatinine", "value": "1.1", "unit": "mg/dL", "ref": "0.7 - 1.3"},
            {"test": "Potassium", "value": "4.2", "unit": "mmol/L", "ref": "3.5 - 5.0"},
            {"test": "Blood Pressure", "value": "145/92", "unit": "mmHg", "ref": "<120/80"},
        ]
    )

    # 3. Lab Report 2: Follow-up with rising trends
    draw_lab_report(
        "3.png",
        lab_name="SRL Diagnostics",
        date_str=lab2_date,
        values=[
            {"test": "HbA1c", "value": "7.6", "unit": "%", "ref": "4.0 - 5.6"},
            {"test": "Creatinine", "value": "1.5", "unit": "mg/dL", "ref": "0.7 - 1.3"},
            {"test": "Potassium", "value": "5.3", "unit": "mmol/L", "ref": "3.5 - 5.0"},
            {"test": "Blood Pressure", "value": "138/88", "unit": "mmHg", "ref": "<120/80"},
        ],
        patient_note="Compared to baseline from 2 weeks ago: HbA1c +0.4, Creatinine +0.4, K+ +1.1"
    )

    print(f"\nAll test case documents generated in {os.path.abspath(SAMPLES_DIR)}/\n")


if __name__ == '__main__':
    main()
