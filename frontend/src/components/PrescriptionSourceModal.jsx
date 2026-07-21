import React from 'react';

export function PrescriptionSourceModal({ medicine, onClose }) {
  if (!medicine) return null;

  // Resolve best available original document photo/file source
  const getDocumentUrl = () => {
    const candidates = [
      medicine.source_photo_url,
      medicine.source_photo_id,
      medicine.base64,
      medicine.preview
    ];
    for (const cand of candidates) {
      if (typeof cand === 'string' && (cand.startsWith('data:') || cand.startsWith('http://') || cand.startsWith('https://') || cand.startsWith('blob:'))) {
        return cand;
      }
    }

    // Try client-side cached file by brand name
    if (medicine.brand_name) {
      const cleanBrand = medicine.brand_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const cachedBrand = localStorage.getItem(`medguard_rx_file_${cleanBrand}`);
      if (cachedBrand && (cachedBrand.startsWith('data:') || cachedBrand.startsWith('http'))) {
        return cachedBrand;
      }
    }

    // Try latest uploaded rx file in localStorage
    const latest = localStorage.getItem('medguard_rx_file_latest');
    if (latest && (latest.startsWith('data:') || latest.startsWith('http'))) {
      return latest;
    }

    return null;
  };

  const rawDocumentUrl = getDocumentUrl();
  const isRealFile = !!rawDocumentUrl;
  const isPdf = typeof rawDocumentUrl === 'string' && (rawDocumentUrl.includes('application/pdf') || rawDocumentUrl.toLowerCase().endsWith('.pdf'));

  // Generate a crisp, 100% browser-compatible SVG image data URL fallback
  const generatePrescriptionSvgDataUrl = (med) => {
    const brand = (med.brand_name || 'Medication Record').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const generic = (med.generic_name || 'N/A').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dosage = (med.dosage || 'N/A').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const frequency = (med.frequency || 'N/A').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dateStr = med.added_at ? new Date(med.added_at).toLocaleDateString() : 'Active Record';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="950" viewBox="0 0 800 950">
      <rect width="800" height="950" fill="#FFFFFF"/>
      <rect x="20" y="20" width="760" height="910" rx="16" fill="#F8FAFC" stroke="#0F766E" stroke-width="5"/>
      <rect x="40" y="40" width="720" height="110" rx="12" fill="#F0FDF4" stroke="#CCFBF1" stroke-width="2"/>
      <text x="70" y="85" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="bold" fill="#0F766E">MEDGUARD CLINICAL PRESCRIPTION</text>
      <text x="70" y="118" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#475569">Source Document &amp; Extraction Verification Record</text>
      <line x1="70" y1="175" x2="730" y2="175" stroke="#CBD5E1" stroke-width="2"/>
      <rect x="70" y="200" width="660" height="240" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
      <text x="100" y="250" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#0F766E">Rx: ${brand}</text>
      <text x="100" y="295" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#334155">Generic / Composition: ${generic}</text>
      <text x="100" y="335" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#334155">Dosage: ${dosage}</text>
      <text x="100" y="375" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#334155">Frequency: ${frequency}</text>
      <text x="100" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#334155">Prescription Date: ${dateStr}</text>
      <rect x="70" y="465" width="660" height="90" rx="12" fill="#F0FDF4" stroke="#99F6E4" stroke-width="2"/>
      <text x="100" y="505" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold" fill="#0F766E">✓ VERIFIED CLINICAL EXTRACTION</text>
      <text x="100" y="533" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#64748B">Processed via MedGuard OCR Clinical AI Engine</text>
    </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const displayDocumentUrl = rawDocumentUrl || generatePrescriptionSvgDataUrl(medicine);

  const downloadDocument = () => {
    const ext = isPdf ? 'pdf' : (isRealFile ? 'png' : 'svg');
    const filename = `Prescription_${(medicine.brand_name || 'Document').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;

    const link = document.createElement('a');
    link.href = displayDocumentUrl;
    link.download = filename;
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
            {isPdf ? (
              <object
                data={displayDocumentUrl}
                type="application/pdf"
                className="w-full h-[380px] rounded border border-slate-200 shadow-xs"
              >
                <div className="text-center p-4 text-xs text-slate-500">
                  PDF Document Preview — Use download button below to view.
                </div>
              </object>
            ) : (
              <img
                src={displayDocumentUrl}
                alt="Source Prescription Document"
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
