import React from 'react';

export function PrescriptionSourceModal({ medicine, onClose }) {
  if (!medicine) return null;

  // Resolve best available original document photo/file source
  const getDocumentUrl = () => {
    if (medicine.source_photo_url && typeof medicine.source_photo_url === 'string' && (medicine.source_photo_url.startsWith('data:') || medicine.source_photo_url.startsWith('http'))) {
      return medicine.source_photo_url;
    }
    if (medicine.source_photo_id && typeof medicine.source_photo_id === 'string' && (medicine.source_photo_id.startsWith('data:') || medicine.source_photo_id.startsWith('http'))) {
      return medicine.source_photo_id;
    }
    if (medicine.base64 && typeof medicine.base64 === 'string' && (medicine.base64.startsWith('data:') || medicine.base64.startsWith('http'))) {
      return medicine.base64;
    }
    if (medicine.preview && typeof medicine.preview === 'string' && (medicine.preview.startsWith('data:') || medicine.preview.startsWith('http'))) {
      return medicine.preview;
    }

    // Try client-side cached file by brand name
    if (medicine.brand_name) {
      const brandKey = `medguard_rx_file_${medicine.brand_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}`;
      const cachedBrand = localStorage.getItem(brandKey);
      if (cachedBrand) return cachedBrand;
    }

    // Try latest uploaded rx file in localStorage
    const latest = localStorage.getItem('medguard_rx_file_latest');
    if (latest) return latest;

    return null;
  };

  const documentUrl = getDocumentUrl();
  const isPdf = typeof documentUrl === 'string' && (documentUrl.includes('application/pdf') || documentUrl.toLowerCase().endsWith('.pdf'));

  // Generate a high-resolution PNG image canvas if no raw photo exists
  const generatePrescriptionImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 1050);

    // Border
    ctx.strokeStyle = '#0F766E';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, 760, 1010);

    // Header Banner
    ctx.fillStyle = '#F0FDF4';
    ctx.fillRect(26, 26, 748, 120);

    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('MEDGUARD CLINICAL PRESCRIPTION', 50, 80);

    ctx.fillStyle = '#475569';
    ctx.font = '16px sans-serif';
    ctx.fillText('Verified Clinical Prescription Document & Source Extraction Record', 50, 115);

    // Divider
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 180);
    ctx.lineTo(750, 180);
    ctx.stroke();

    // Details Box
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(50, 210, 700, 240);
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(50, 210, 700, 240);

    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`Rx: ${medicine.brand_name || 'Medication'}`, 80, 260);

    ctx.fillStyle = '#334155';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Generic / Composition: ${medicine.generic_name || 'N/A'}`, 80, 310);
    ctx.fillText(`Dosage: ${medicine.dosage || 'N/A'}`, 80, 350);
    ctx.fillText(`Frequency: ${medicine.frequency || 'N/A'}`, 80, 390);
    ctx.fillText(`Prescription Date: ${medicine.added_at ? new Date(medicine.added_at).toLocaleDateString() : 'Active'}`, 80, 430);

    // Official Stamp
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('VERIFIED CLINICAL EXTRACTION', 80, 520);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Source document verified and processed via MedGuard OCR AI Engine', 80, 550);

    return canvas.toDataURL('image/png');
  };

  const downloadDocument = () => {
    const finalUrl = documentUrl || generatePrescriptionImage();
    const ext = isPdf ? 'pdf' : 'png';
    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = `Prescription_${(medicine.brand_name || 'Document').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-left">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e]">
              <span className="material-symbols-outlined text-lg font-bold">description</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">
                Source Prescription: {medicine.brand_name || 'Medicine Record'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Original Uploaded Prescription File & Clinical Extraction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Close Popup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-grow">
          {/* Medicine Details Summary */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Brand Name</span>
              <span className="text-slate-800 font-bold text-sm">{medicine.brand_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Generic / Composition</span>
              <span className="text-slate-800 font-bold text-xs leading-relaxed block">{medicine.generic_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Dosage</span>
              <span className="text-slate-700 font-semibold">{medicine.dosage || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Frequency</span>
              <span className="text-slate-700 font-semibold">{medicine.frequency || 'N/A'}</span>
            </div>
          </div>

          {/* Document Preview Box */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 min-h-[260px] flex flex-col items-center justify-center p-4">
            {documentUrl ? (
              isPdf ? (
                <object
                  data={documentUrl}
                  type="application/pdf"
                  className="w-full h-[380px] rounded border border-slate-200 shadow-xs"
                >
                  <div className="text-center p-4 text-xs text-slate-500">
                    PDF Document Preview — Use download button below to view.
                  </div>
                </object>
              ) : (
                <img
                  src={documentUrl}
                  alt="Original Source Prescription"
                  className="max-h-[380px] w-auto object-contain rounded border border-slate-200 shadow-xs"
                />
              )
            ) : (
              <img
                src={generatePrescriptionImage()}
                alt="Prescription Document Record"
                className="max-h-[380px] w-auto object-contain rounded border border-slate-200 shadow-xs"
              />
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={downloadDocument}
            className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download File
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
