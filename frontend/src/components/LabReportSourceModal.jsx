import React from 'react';
import { unescapeHTML } from '../lib/utils';

export function LabReportSourceModal({ report, onClose }) {
  if (!report) return null;

  const downloadDocument = () => {
    if (report.source_photo_url || report.base64) {
      const link = document.createElement('a');
      link.href = report.source_photo_url || report.base64;
      link.download = `LabReport_${report.id || 'Clinical'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Build clean text clinical summary report download
      let valuesText = '';
      if (report.values && Array.isArray(report.values)) {
        valuesText = report.values.map(v => `- ${unescapeHTML(v.test_type)}: ${v.value} ${unescapeHTML(v.unit || '')}`).join('\n');
      } else {
        valuesText = 'No lab values extracted.';
      }

      const content = `MEDGUARD CLINICAL LAB REPORT VERIFICATION RECORD\n\nDate: ${report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString() : 'N/A'}\nDoctor: ${report.doctor_name || 'Generic Provider'}\nDisease/Panel: ${report.disease_type || report.panel_name || 'Diagnostic Lab Panel'}\n\nMEASURED TEST VALUES:\n${valuesText}\n`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Lab_Report_Record_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
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
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100/70 min-h-[220px] flex flex-col items-center justify-center p-4">
            {report.source_photo_url || report.base64 ? (
              <img
                src={report.source_photo_url || report.base64}
                alt="Source Lab Report"
                className="max-h-[380px] w-auto object-contain rounded border border-slate-200 shadow-xs"
              />
            ) : (
              <div className="text-center p-6 space-y-2">
                <span className="material-symbols-outlined text-5xl text-slate-300">lab_panel</span>
                <p className="text-xs font-bold text-slate-700">Digital Lab Extraction Record</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Extracted from verified laboratory report on {report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString() : 'Report Upload'}.
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
          <button
            type="button"
            onClick={downloadDocument}
            className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download Document
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
