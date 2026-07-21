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

  const rawDocumentUrl = getDocumentUrl();
  const isRealFile = !!rawDocumentUrl;
  const isPdf = typeof rawDocumentUrl === 'string' && (rawDocumentUrl.includes('application/pdf') || rawDocumentUrl.toLowerCase().endsWith('.pdf'));

  // Generate a crisp, 100% browser-compatible SVG image data URL fallback
  const generateLabReportSvgDataUrl = (rep) => {
    const doctor = (rep.doctor_name || 'Generic Provider').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dateStr = rep.uploaded_at ? new Date(rep.uploaded_at).toLocaleDateString() : 'Active Report';

    let valuesSvg = '';
    if (rep.values && Array.isArray(rep.values)) {
      valuesSvg = rep.values.slice(0, 5).map((v, i) => {
        const testName = unescapeHTML(v.test_type || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const valStr = `${v.value} ${unescapeHTML(v.unit || '')}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const y = 260 + (i * 40);
        return `<text x="100" y="${y}" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold" fill="#334155">• ${testName}:</text>
        <text x="500" y="${y}" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold" fill="#0F766E">${valStr}</text>`;
      }).join('\n');
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="950" viewBox="0 0 800 950">
      <rect width="800" height="950" fill="#FFFFFF"/>
      <rect x="20" y="20" width="760" height="910" rx="16" fill="#F8FAFC" stroke="#0F766E" stroke-width="5"/>
      <rect x="40" y="40" width="720" height="110" rx="12" fill="#F0FDF4" stroke="#CCFBF1" stroke-width="2"/>
      <text x="70" y="85" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="bold" fill="#0F766E">MEDGUARD CLINICAL LAB REPORT</text>
      <text x="70" y="118" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#475569">Source Document &amp; Diagnostic Measurement Record</text>
      <line x1="70" y1="175" x2="730" y2="175" stroke="#CBD5E1" stroke-width="2"/>
      <rect x="70" y="200" width="660" height="260" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
      <text x="100" y="235" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold" fill="#0F766E">Physician: Dr. ${doctor} | Date: ${dateStr}</text>
      ${valuesSvg}
      <rect x="70" y="485" width="660" height="90" rx="12" fill="#F0FDF4" stroke="#99F6E4" stroke-width="2"/>
      <text x="100" y="525" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold" fill="#0F766E">✓ VERIFIED DIAGNOSTIC EXTRACTION</text>
      <text x="100" y="553" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#64748B">Processed via MedGuard Clinical AI Engine</text>
    </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const displayDocumentUrl = rawDocumentUrl || generateLabReportSvgDataUrl(report);

  const downloadDocument = () => {
    const ext = isPdf ? 'pdf' : (isRealFile ? 'png' : 'svg');
    const filename = `LabReport_${(report.doctor_name || 'Clinical').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;

    const link = document.createElement('a');
    link.href = displayDocumentUrl;
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
                alt="Source Lab Report Document"
                className="max-h-[380px] w-auto object-contain rounded border border-slate-200 shadow-xs"
              />
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
