import React, { useEffect } from 'react';
import { unescapeHTML } from '../lib/utils';

export function LabReportSourceModal({ report, onClose }) {
  if (!report) return null;

  // Lock background page scroll while popup is open on mobile/desktop
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  // Resolve best available original document photo/file source
  const getDocumentUrl = () => {
    const candidates = [
      report.source_photo_url,
      report.source_photo_id,
      report.base64,
      report.preview
    ];
    for (const cand of candidates) {
      if (typeof cand === 'string' && (cand.startsWith('data:') || cand.startsWith('http://') || cand.startsWith('https://') || cand.startsWith('blob:'))) {
        return cand;
      }
    }
    const latest = localStorage.getItem('medguard_lab_file_latest');
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
    const filename = `LabReport_${(report.doctor_name || 'Clinical').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;

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
        {/* Mobile Header Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="Back to Reports"
            >
              <span className="material-symbols-outlined text-2xl block">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">
                {report.doctor_name ? `Dr. ${report.doctor_name}` : 'Source Lab Report'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Recorded on {report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date Unspecified'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            title="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Mobile Page Body */}
        <div className="p-4 space-y-4 pb-24">
          {/* Document Display Container */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 p-2 min-h-[260px] flex flex-col items-center justify-center">
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
                  alt="Original Uploaded Lab Report Document"
                  className="w-full h-auto max-h-[460px] object-contain rounded border border-slate-200 shadow-xs"
                />
              )
            ) : (
              <div className="text-center p-8 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">no_photography</span>
                <p className="text-xs font-bold text-slate-700">No Original Lab Report Photo Attached</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  This report was created manually or prior to original document file upload.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Fixed Action Bar at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between gap-3 z-30 shadow-lg">
          {isRealFile ? (
            <button
              type="button"
              onClick={downloadDocument}
              className="flex-grow bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download File
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex-grow bg-slate-200 text-slate-400 font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">download_off</span>
              No File
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Close
          </button>
        </div>
      </div>

      {/* Desktop Modal Popup (>= 640px) */}
      <div className="hidden sm:flex fixed inset-0 z-50 items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-left overscroll-contain overflow-hidden">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e] flex-shrink-0">
                <span className="material-symbols-outlined text-lg font-bold">science</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800 leading-tight truncate">
                  Source Lab Report: {report.doctor_name ? `Dr. ${report.doctor_name}` : 'Clinical Diagnostic Panel'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  Recorded on {report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date Unspecified'}
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
            {/* Document Preview Box */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 min-h-[240px] flex flex-col items-center justify-center p-4">
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
                    alt="Original Uploaded Lab Report Document"
                    className="max-h-[380px] w-auto object-contain rounded border border-slate-200 shadow-xs"
                  />
                )
              ) : (
                <div className="text-center p-8 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300">no_photography</span>
                  <p className="text-xs font-bold text-slate-700">No Original Lab Report Photo Attached</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    This report was created manually or prior to original document file upload.
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
                Download Lab Report File
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="bg-slate-200 text-slate-400 font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                title="No original lab report file attached"
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
