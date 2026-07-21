import React from 'react';
import { unescapeHTML } from '../lib/utils';

export function LabReportSourceModal({ report, onClose }) {
  if (!report) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-left">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e]">
              <span className="material-symbols-outlined text-lg font-bold">science</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">
                Source Lab Report: {report.doctor_name ? `Dr. ${report.doctor_name}` : 'Clinical Diagnostic Panel'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Recorded on {report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date Unspecified'}
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

          {/* Extracted Values Summary Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Test Parameter</th>
                  <th className="px-4 py-2.5">Measured Value</th>
                  <th className="px-4 py-2.5">Panel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {report.values && report.values.length > 0 ? (
                  report.values.map((val, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">{unescapeHTML(val.test_type)}</td>
                      <td className="px-4 py-3 font-extrabold text-[#0f766e]">
                        {val.value} <span className="font-semibold text-slate-500 text-[11px]">{unescapeHTML(val.unit || '')}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium">{unescapeHTML(val.panel_name || 'Standard Panel')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">No lab values recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
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
              title="No original uploaded lab report file available for this record"
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
  );
}
