import React from 'react'

export function LabReportReviewForm({ labFields, setLabFields, confidenceScores, getConfidenceBadge }) {
  const confidence = confidenceScores || {}

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-700">Test Type</label>
            {getConfidenceBadge(confidence.test_type ?? 1.0)}
          </div>
          <input
            type="text"
            required
            value={labFields.test_type}
            onChange={(e) => setLabFields({ ...labFields, test_type: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Panel Name</label>
          <input
            type="text"
            value={labFields.panel_name}
            onChange={(e) => setLabFields({ ...labFields, panel_name: e.target.value })}
            placeholder="e.g. Lipid Profile"
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-700">Measured Value</label>
            {getConfidenceBadge(confidence.value ?? 1.0)}
          </div>
          <input
            type="text"
            required
            value={labFields.value}
            onChange={(e) => setLabFields({ ...labFields, value: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
          <input
            type="text"
            required
            value={labFields.unit}
            onChange={(e) => setLabFields({ ...labFields, unit: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Disease / Clinical Indication</label>
        <input
          type="text"
          value={labFields.disease_type}
          onChange={(e) => setLabFields({ ...labFields, disease_type: e.target.value })}
          placeholder="e.g. Diabetes, Thyroid"
          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Report Date</label>
        <input
          type="date"
          required
          value={labFields.recorded_at}
          onChange={(e) => setLabFields({ ...labFields, recorded_at: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
        />
      </div>
    </div>
  )
}
