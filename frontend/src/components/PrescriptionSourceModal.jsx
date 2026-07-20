import React from 'react';

export function PrescriptionSourceModal({ medicine, onClose }) {
  if (!medicine) return null;

  const documentUrl = medicine.source_photo_url || medicine.source_photo_id || medicine.base64 || medicine.preview;
  const isPdf = typeof documentUrl === 'string' && (documentUrl.includes('application/pdf') || documentUrl.toLowerCase().endsWith('.pdf'));

  const downloadDocument = () => {
    if (documentUrl && typeof documentUrl === 'string' && (documentUrl.startsWith('data:') || documentUrl.startsWith('http') || documentUrl.startsWith('blob:'))) {
      const ext = isPdf ? 'pdf' : 'png';
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = `Prescription_${(medicine.brand_name || 'Document').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Clean text record download fallback
      const content = `MEDGUARD PRESCRIPTION VERIFICATION RECORD\n\nBrand Name: ${medicine.brand_name || 'N/A'}\nGeneric/Composition: ${medicine.generic_name || 'N/A'}\nDosage: ${medicine.dosage || 'N/A'}\nFrequency: ${medicine.frequency || 'N/A'}\nAdded Date: ${medicine.added_at ? new Date(medicine.added_at).toLocaleDateString() : 'N/A'}\nStatus: ${medicine.status || 'Active'}\n`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Prescription_Record_${(medicine.brand_name || 'Medicine').replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
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
                Original Uploaded Prescription File & Extraction Details
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
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 min-h-[240px] flex flex-col items-center justify-center p-4">
            {documentUrl && typeof documentUrl === 'string' && (documentUrl.startsWith('data:') || documentUrl.startsWith('http') || documentUrl.startsWith('blob:')) ? (
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
              <div className="text-center p-6 space-y-2">
                <span className="material-symbols-outlined text-5xl text-slate-300">receipt_long</span>
                <p className="text-xs font-bold text-slate-700">Digital Clinical Record</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Extracted from verified clinical record on {medicine.added_at ? new Date(medicine.added_at).toLocaleDateString() : 'Prescription Upload'}.
                </p>
              </div>
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
