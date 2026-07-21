import React, { useEffect } from 'react';
import { unescapeHTML } from '../lib/utils';

export function PrescriptionSourceModal({ medicine, onClose }) {
  if (!medicine) return null;

  // Scroll to top when view opens
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Resolve best available original document photo/file source
  const getDocumentUrl = () => {
    const candidates = [
      medicine.source_photo_url,
      medicine.source_photo_id,
      medicine.base64,
      medicine.preview
    ];

    // Priority 1: Direct permanent Data URL or HTTP URL
    for (const cand of candidates) {
      if (typeof cand === 'string' && (cand.startsWith('data:image/') || cand.startsWith('data:application/pdf') || cand.startsWith('http://') || cand.startsWith('https://'))) {
        return cand;
      }
    }

    // Priority 2: Client-side cached file by medicine ID
    if (medicine.id) {
      const cachedId = localStorage.getItem(`medguard_rx_id_${medicine.id}`);
      if (cachedId && (cachedId.startsWith('data:') || cachedId.startsWith('http'))) {
        return cachedId;
      }
    }

    // Priority 3: Client-side cached file by brand name
    if (medicine.brand_name) {
      const cleanBrand = medicine.brand_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const cachedBrand = localStorage.getItem(`medguard_rx_file_${cleanBrand}`);
      if (cachedBrand && (cachedBrand.startsWith('data:') || cachedBrand.startsWith('http'))) {
        return cachedBrand;
      }
    }

    // Priority 4: Blob URL (only if valid in current session)
    for (const cand of candidates) {
      if (typeof cand === 'string' && cand.startsWith('blob:')) {
        return cand;
      }
    }

    // Priority 5: Latest uploaded rx file in localStorage
    const latest = localStorage.getItem('medguard_rx_file_latest');
    if (latest && (latest.startsWith('data:') || latest.startsWith('http'))) {
      return latest;
    }

    return null;
  };

  const documentUrl = getDocumentUrl();
  const isRealFile = !!documentUrl;
  const isPdf = typeof documentUrl === 'string' && (documentUrl.includes('application/pdf') || documentUrl.toLowerCase().endsWith('.pdf'));

  const downloadDocument = () => {
    if (!documentUrl) return;
    const ext = isPdf ? 'pdf' : 'png';
    const cleanName = unescapeHTML(medicine.brand_name || 'Document').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Prescription_${cleanName}.${ext}`;

    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Mobile Dedicated View Page (< 640px) */}
      <div className="fixed inset-0 z-50 bg-white flex flex-col h-full overflow-y-auto sm:hidden animate-fade-in text-left">
        {/* Mobile Sticky Header Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="Back"
            >
              <span className="material-symbols-outlined text-2xl block">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">
                {unescapeHTML(medicine.brand_name || 'Prescription Details')}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Original Uploaded Prescription File
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isRealFile && (
              <button
                type="button"
                onClick={downloadDocument}
                className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                title="Download Original File"
              >
                <span className="material-symbols-outlined text-base font-bold">download</span>
                <span className="text-[11px] font-bold">Download</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <span className="material-symbols-outlined text-xl font-bold">close</span>
            </button>
          </div>
        </div>

        {/* Mobile Page Content (Scrollable from top) */}
        <div className="p-4 space-y-4 pb-8 overflow-y-auto">
          {/* Medicine Details Summary (Brand Name mentioned in Header above) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Generic / Composition</span>
              <span className="text-slate-800 font-bold text-sm leading-relaxed block">{unescapeHTML(medicine.generic_name || 'N/A')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-slate-200/60">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Dosage</span>
                <span className="text-slate-700 font-semibold">{unescapeHTML(medicine.dosage || 'N/A')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Frequency</span>
                <span className="text-slate-700 font-semibold">{unescapeHTML(medicine.frequency || 'N/A')}</span>
              </div>
            </div>
          </div>

          {/* Document Display Container (Full resolution scrollable) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 p-2 min-h-[300px] flex flex-col items-center justify-center">
            {isRealFile ? (
              isPdf ? (
                <object
                  data={documentUrl}
                  type="application/pdf"
                  className="w-full h-[450px] rounded border border-slate-200 shadow-xs"
                >
                  <div className="text-center p-4 text-xs text-slate-500">
                    PDF Document Preview — Use download button above to view.
                  </div>
                </object>
              ) : (
                <img
                  src={documentUrl}
                  alt="Original Uploaded Prescription File"
                  className="w-full h-auto object-contain rounded border border-slate-200 shadow-xs"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = '<div class="text-center p-6 space-y-2"><span class="material-symbols-outlined text-3xl text-slate-300">broken_image</span><p class="text-xs font-bold text-slate-700">Prescription Photo Expired or Unavailable</p><p class="text-[11px] text-slate-500 max-w-sm mx-auto">Original prescription photo link has expired. Please re-upload this document to attach a permanent copy.</p></div>';
                  }}
                />
              )
            ) : (
              <div className="text-center p-8 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">no_photography</span>
                <p className="text-xs font-bold text-slate-700">Uploaded Prescription Photo Not Found</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Original prescription file was not found for this record.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Modal Popup (>= 640px) */}
      <div className="hidden sm:flex fixed inset-0 z-50 items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-left overscroll-contain overflow-hidden">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e] flex-shrink-0">
                <span className="material-symbols-outlined text-lg font-bold">description</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800 leading-tight truncate">
                  Source Prescription: {unescapeHTML(medicine.brand_name || 'Medicine Record')}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  Original Uploaded Prescription File
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="Close Popup"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-grow overscroll-contain">
            {/* Medicine Details Summary */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Brand Name</span>
                <span className="text-slate-800 font-bold text-sm">{unescapeHTML(medicine.brand_name || 'N/A')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Generic / Composition</span>
                <span className="text-slate-800 font-bold text-xs leading-relaxed block">{unescapeHTML(medicine.generic_name || 'N/A')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Dosage</span>
                <span className="text-slate-700 font-semibold">{unescapeHTML(medicine.dosage || 'N/A')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Frequency</span>
                <span className="text-slate-700 font-semibold">{unescapeHTML(medicine.frequency || 'N/A')}</span>
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 min-h-[260px] flex flex-col items-center justify-center p-4">
              {isRealFile ? (
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
                    alt="Original Uploaded Prescription File"
                    className="max-h-[380px] w-auto object-contain rounded border border-slate-200 shadow-xs"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = '<div class="text-center p-6 space-y-2"><span class="material-symbols-outlined text-3xl text-slate-300">broken_image</span><p class="text-xs font-bold text-slate-700">Prescription Photo Expired or Unavailable</p><p class="text-[11px] text-slate-500 max-w-sm mx-auto">Original prescription photo link has expired. Please re-upload this document to attach a permanent copy.</p></div>';
                    }}
                  />
                )
              ) : (
                <div className="text-center p-8 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300">no_photography</span>
                  <p className="text-xs font-bold text-slate-700">Uploaded Prescription Photo Not Found</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Original prescription file was not found for this record.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
            {isRealFile ? (
              <button
                type="button"
                onClick={downloadDocument}
                className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Download Original File
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="bg-slate-200 text-slate-400 font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                title="No original uploaded prescription file available for this record"
              >
                <span className="material-symbols-outlined text-sm">download_off</span>
                No File Attached
              </button>
            )}
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
    </>
  );
}
