export function VisitLinkPanel({
  activeExtraction,
  linkVisitOption,
  setLinkVisitOption,
  selectedVisitId,
  setSelectedVisitId,
  newVisitData,
  setNewVisitData
}) {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[#0f766e] text-base">calendar_today</span>
        Link to Doctor Visit
      </h4>

      {activeExtraction.proposed_visit_id && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] rounded flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">verified</span>
          <span>Matched to proximity visit (confidence: 95%).</span>
        </div>
      )}

      <div className="flex flex-col gap-2 text-[11px] font-semibold text-slate-600">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input 
            type="radio" 
            name="linkOption" 
            value="none" 
            checked={linkVisitOption === 'none'} 
            onChange={(e) => setLinkVisitOption(e.target.value)} 
            className="text-[#0f766e] focus:ring-[#0f766e]" 
          />
          Do not link
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input 
            type="radio" 
            name="linkOption" 
            value="existing" 
            checked={linkVisitOption === 'existing'} 
            onChange={(e) => setLinkVisitOption(e.target.value)} 
            className="text-[#0f766e] focus:ring-[#0f766e]" 
          />
          Select existing visit
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input 
            type="radio" 
            name="linkOption" 
            value="new" 
            checked={linkVisitOption === 'new'} 
            onChange={(e) => setLinkVisitOption(e.target.value)} 
            className="text-[#0f766e] focus:ring-[#0f766e]" 
          />
          Create new visit inline
        </label>
      </div>

      {linkVisitOption === 'existing' && (
        <div className="relative mt-2">
          <select
            value={selectedVisitId}
            onChange={(e) => setSelectedVisitId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none"
          >
            {activeExtraction.candidate_visits && activeExtraction.candidate_visits.length > 0 ? (
              activeExtraction.candidate_visits.map(v => (
                <option key={v.id} value={v.id}>
                  {new Date(v.scheduled_date).toLocaleDateString()} — Dr. {v.doctor_name || 'Unknown'} ({v.specialty || 'General'})
                </option>
              ))
            ) : (
              <option value="">No existing visits found</option>
            )}
          </select>
        </div>
      )}

      {linkVisitOption === 'new' && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-left">
          <div className="col-span-2">
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Appointment Date</label>
            <input
              type="datetime-local"
              required
              value={newVisitData.scheduled_date}
              onChange={(e) => setNewVisitData({ ...newVisitData, scheduled_date: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Doctor Name</label>
            <input
              type="text"
              placeholder="Dr. Kumar"
              value={newVisitData.doctor_name}
              onChange={(e) => setNewVisitData({ ...newVisitData, doctor_name: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Specialty</label>
            <input
              type="text"
              placeholder="Cardiology"
              value={newVisitData.specialty}
              onChange={(e) => setNewVisitData({ ...newVisitData, specialty: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
