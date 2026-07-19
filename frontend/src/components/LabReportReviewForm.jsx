import React from 'react'
import { unescapeHTML } from '../lib/utils'
import { InfoButton } from './InfoButton'

export function LabReportReviewForm({
  labFields,
  setLabFields,
  labTests,
  setLabTests,
  confidenceScores,
  getConfidenceBadge,
  onShowInfo
}) {
  const confidence = confidenceScores || {}

  const updateTest = (index, field, value) => {
    const updated = [...labTests];
    updated[index] = { ...updated[index], [field]: value };
    setLabTests(updated);
  };

  const removeTest = (index) => {
    setLabTests(labTests.filter((_, i) => i !== index));
  };

  const addTest = () => {
    setLabTests([...labTests, {
      test_type: '',
      value: '',
      unit: '',
      ref_range: ''
    }]);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lab Report Values</span>
          <button
            type="button"
            onClick={addTest}
            className="text-xs bg-white hover:bg-slate-50 text-[#0f766e] border border-slate-200 rounded-lg px-3 py-1.5 font-semibold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">add</span> Add Test
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 w-1/3">
                  <span className="flex items-center gap-1">Test Type
                    <InfoButton
                      onShowInfo={onShowInfo}
                      fieldName="Test Type"
                      description="The name of the laboratory test or biomarker being measured."
                      example="HbA1c, TSH, Complete Blood Count"
                    />
                  </span>
                </th>
                <th className="px-4 py-2 w-1/4">
                  <span className="flex items-center gap-1">Measured Value
                    <InfoButton
                      onShowInfo={onShowInfo}
                      fieldName="Measured Value"
                      description="The numeric or qualitative result from the laboratory analysis."
                      example="7.2, 3.5, Positive"
                    />
                  </span>
                </th>
                <th className="px-4 py-2 w-1/5">
                  <span className="flex items-center gap-1">Unit
                    <InfoButton
                      onShowInfo={onShowInfo}
                      fieldName="Unit"
                      description="The measurement unit for the test result."
                      example="%, mg/dL, mIU/L"
                    />
                  </span>
                </th>
                <th className="px-4 py-2 w-1/4">
                  <span className="flex items-center gap-1">Ref. Range
                    <InfoButton
                      onShowInfo={onShowInfo}
                      fieldName="Reference Range"
                      description="The normal/reference range for healthy individuals. Used to flag abnormal results."
                      example="4.0 - 5.6, 0.4 - 4.0"
                    />
                  </span>
                </th>
                <th className="px-2 py-2 w-[40px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {labTests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400 italic">
                    No tests extracted. Click "Add Test" to add values manually.
                  </td>
                </tr>
              ) : (
                labTests.map((test, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        required
                        value={unescapeHTML(test.test_type)}
                        onChange={(e) => updateTest(index, 'test_type', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-350 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all font-medium text-slate-800"
                        placeholder="e.g. HbA1c"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        required
                        value={unescapeHTML(test.value)}
                        onChange={(e) => updateTest(index, 'value', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-350 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all font-medium text-slate-800"
                        placeholder="e.g. 7.2"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        required
                        value={unescapeHTML(test.unit)}
                        onChange={(e) => updateTest(index, 'unit', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-350 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all font-medium text-slate-800"
                        placeholder="e.g. %"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={unescapeHTML(test.ref_range || '')}
                        onChange={(e) => updateTest(index, 'ref_range', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-350 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all font-medium text-slate-800"
                        placeholder="e.g. 4.0 - 5.6"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeTest(index)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50 cursor-pointer"
                        title="Remove Test"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">
            <span className="inline-flex items-center gap-1">Panel / Report Name
              <InfoButton
                onShowInfo={onShowInfo}
                fieldName="Panel Name"
                description="The name of the lab panel or report group this test belongs to."
                example="Clinical Laboratory Report, Lipid Panel"
              />
            </span>
          </label>
          <input
            type="text"
            value={labFields.panel_name || ''}
            onChange={(e) => setLabFields({ ...labFields, panel_name: e.target.value })}
            placeholder="e.g. Clinical Laboratory Report"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">
            <span className="inline-flex items-center gap-1">Disease / Clinical Indication
              <InfoButton
                onShowInfo={onShowInfo}
                fieldName="Disease Type"
                description="The clinical indication or condition being investigated by this lab report."
                example="Diabetes, Thyroid, Lipid"
              />
            </span>
          </label>
          <input
            type="text"
            value={labFields.disease_type || ''}
            onChange={(e) => setLabFields({ ...labFields, disease_type: e.target.value })}
            placeholder="e.g. Diabetes, Thyroid"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">
            <span className="inline-flex items-center gap-1">Report Date
              <InfoButton
                onShowInfo={onShowInfo}
                fieldName="Report Date"
                description="The date the laboratory report was generated or the sample was collected."
                example="2026-01-15"
              />
            </span>
          </label>
          <input
            type="date"
            required
            value={labFields.recorded_at || ''}
            onChange={(e) => setLabFields({ ...labFields, recorded_at: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-all"
          />
        </div>
      </div>
    </div>
  )
}
