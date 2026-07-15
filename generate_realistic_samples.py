import os
from PIL import Image, ImageDraw, ImageFont

def create_realistic_prescription(doctor_name, clinic_name, patient_name, date_str, rx_items, filename):
    # Create canvas simulating a real prescription paper (light cream color #fcfbf6)
    width, height = 800, 1000
    img = Image.new("RGB", (width, height), "#fcfbf6")
    draw = ImageDraw.Draw(img)

    # Load fonts
    try:
        # Use standard Windows fonts
        header_font_bold = ImageFont.truetype("C:\\Windows\\Fonts\\segoeuib.ttf", 26)
        header_font = ImageFont.truetype("C:\\Windows\\Fonts\\segoeui.ttf", 15)
        rx_symbol_font = ImageFont.truetype("C:\\Windows\\Fonts\\georgiab.ttf", 36)
        # Segoe Print simulates handwriting beautifully
        handwriting_font = ImageFont.truetype("C:\\Windows\\Fonts\\segoepr.ttf", 18)
        handwriting_font_large = ImageFont.truetype("C:\\Windows\\Fonts\\segoepr.ttf", 22)
    except IOError:
        # Fallback to default if fonts not found
        header_font_bold = ImageFont.load_default()
        header_font = ImageFont.load_default()
        rx_symbol_font = ImageFont.load_default()
        handwriting_font = ImageFont.load_default()
        handwriting_font_large = ImageFont.load_default()

    # 1. Header (Clinic Letterhead)
    draw.text((60, 50), clinic_name.upper(), fill="#0f766e", font=header_font_bold)
    draw.text((60, 90), f"Physician: {doctor_name}  |  Reg No: MC-48902", fill="#475569", font=header_font)
    draw.text((60, 110), "Address: 42, Health Avenue, Medical District  |  Ph: +91 98765 43210", fill="#64748b", font=header_font)
    
    # Separator Line
    draw.line([(60, 140), (width - 60, 140)], fill="#0f766e", width=3)

    # Patient details in handwriting style
    draw.text((60, 170), f"Patient Name: {patient_name}", fill="#1e293b", font=header_font)
    draw.text((width - 250, 170), f"Date: {date_str}", fill="#1e293b", font=header_font)
    draw.text((60, 200), "Age: 45   Sex: M", fill="#1e293b", font=header_font)

    # Inner border line
    draw.line([(60, 230), (width - 60, 230)], fill="#cbd5e1", width=1)

    # 2. Prescription body (Rx)
    draw.text((60, 260), "Rx", fill="#0f766e", font=rx_symbol_font)

    # Write Rx items in blue ink simulating a doctor's handwriting
    ink_color = "#1d4ed8"  # Blue ballpoint ink color
    y = 320
    for idx, item in enumerate(rx_items, 1):
        # Med name
        draw.text((80, y), f"{idx}. {item['med_name']}", fill=ink_color, font=handwriting_font_large)
        y += 35
        # Dosage instructions
        draw.text((110, y), f"Sig: {item['sig']}", fill=ink_color, font=handwriting_font)
        y += 30
        # Duration
        draw.text((110, y), f"Dispense: {item['dispense']} ({item['duration']})", fill=ink_color, font=handwriting_font)
        y += 55

    # 3. Signature & Stamp at the bottom
    # Draw doctor signature
    draw.text((width - 280, height - 180), f"Dr. {doctor_name.split()[-1]}", fill=ink_color, font=handwriting_font)
    draw.line([(width - 280, height - 140), (width - 60, height - 140)], fill="#64748b", width=1)
    draw.text((width - 240, height - 130), "Authorized Signature", fill="#64748b", font=header_font)

    # Draw a blue clinic stamp (semi-transparent-looking round shape)
    stamp_img = Image.new("RGBA", (140, 140), (255, 255, 255, 0))
    stamp_draw = ImageDraw.Draw(stamp_img)
    stamp_color = (29, 78, 216, 160)  # Semi-transparent blue
    
    # Outer double circles
    stamp_draw.ellipse([5, 5, 135, 135], outline=stamp_color, width=2)
    stamp_draw.ellipse([10, 10, 130, 130], outline=stamp_color, width=1)
    
    # Text inside stamp
    try:
        stamp_font = ImageFont.truetype("C:\\Windows\\Fonts\\segoeui.ttf", 10)
    except IOError:
        stamp_font = ImageFont.load_default()
        
    stamp_draw.text((38, 40), "MEDGUARD", fill=stamp_color, font=stamp_font)
    stamp_draw.text((32, 55), "CLINIC & LAB", fill=stamp_color, font=stamp_font)
    stamp_draw.text((43, 70), "VERIFIED", fill=stamp_color, font=stamp_font)
    stamp_draw.text((45, 85), "STAMP", fill=stamp_color, font=stamp_font)

    # Rotate stamp slightly for realism
    stamp_rotated = stamp_img.rotate(12, expand=True, resample=Image.BICUBIC)
    
    # Paste stamp onto main image
    img.paste(stamp_rotated, (80, height - 220), stamp_rotated)

    # Save
    img.save(filename)
    print(f"Generated realistic prescription: {filename}")

def main():
    os.makedirs("samples", exist_ok=True)

    # 1. Realistic Prescription Glycomet (Metformin)
    create_realistic_prescription(
        doctor_name="Dr. Ramesh Kumar",
        clinic_name="City Diabetes & Endocrine Centre",
        patient_name="John Doe",
        date_str="2026-07-15",
        rx_items=[
            {
                "med_name": "Glycomet 500 mg",
                "sig": "1 tablet daily after dinner",
                "dispense": "30 Tablets",
                "duration": "30 days"
            }
        ],
        filename="samples/prescription_glycomet_high_confidence.png"
    )

    # 2. Realistic Prescription Crocin (Acetaminophen)
    create_realistic_prescription(
        doctor_name="Dr. Ramesh Kumar",
        clinic_name="Metro Family Health Clinic",
        patient_name="John Doe",
        date_str="2026-07-15",
        rx_items=[
            {
                "med_name": "Crocin 650 mg",
                "sig": "1 tablet three times daily as needed for pain",
                "dispense": "15 Tablets",
                "duration": "5 days"
            }
        ],
        filename="samples/prescription_crocin_low_confidence.png"
    )

    # 3. Realistic Prescription Lipitor (Atorvastatin)
    create_realistic_prescription(
        doctor_name="Dr. Ramesh Kumar",
        clinic_name="Metro Cardiology Specialists",
        patient_name="John Doe",
        date_str="2026-07-15",
        rx_items=[
            {
                "med_name": "Lipitor 10 mg",
                "sig": "1 tablet daily at bedtime",
                "dispense": "30 Tablets",
                "duration": "30 days"
            }
        ],
        filename="samples/prescription_date_proximity.png"
    )

if __name__ == "__main__":
    main()
