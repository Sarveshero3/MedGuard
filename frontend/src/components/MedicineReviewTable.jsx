import React from 'react';

export function MedicineReviewTable({
  medicines,
  setMedicines,
  onResolveBrand
}) {
  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: value };
    setMedicines(updated);
  };

  const removeMedicine = (index) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const addMedicine = () => {
    setMedicines([...medicines, {
      brand_name: '',
      generic_name: '',
      dosage: '',
      frequency: '',
      duration_text: ''
    }]);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs text-slate-700 table-fixed">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 w-[160px]">Brand Name</th>
              <th className="px-3 py-2 w-[220px]">Generic Name</th>
              <th className="px-3 py-2 w-[100px]">Dosage</th>
              <th className="px-3 py-2 w-[120px]">Frequency</th>
              <th className="px-3 py-2 w-[100px]">Duration</th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {medicines.map((med, index) => (
              <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                {/* Brand Name Input */}
                <td className="px-2 py-2">
                  <input
                    type="text"
                    required
                    value={med.brand_name}
                    onChange={(e) => updateMedicine(index, 'brand_name', e.target.value)}
                    onBlur={(e) => {
                      if (onResolveBrand && e.target.value.trim()) {
                        onResolveBrand(index, e.target.value);
                      }
                    }}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all font-medium text-slate-800"
                    placeholder="e.g. Taxim O"
                  />
                </td>

                {/* Generic Name - Read-Only Display */}
                <td className="px-3 py-2">
                  <div className="break-words whitespace-normal max-w-[210px] leading-relaxed">
                    {med.generic_name === 'no such medicine found' ? (
                      <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded px-2 py-0.5 font-semibold text-[10px]">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        No such medicine found
                      </span>
                    ) : med.generic_name ? (
                      <span className="text-slate-650 font-bold block">{med.generic_name}</span>
                    ) : med.brand_name ? (
                      <span className="text-[#0f766e] italic flex items-center gap-1.5 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0f766e] animate-ping"></span>
                        Researching...
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Enter brand name</span>
                    )}
                  </div>
                </td>

                {/* Dosage Input */}
                <td className="px-2 py-2">
                  <input
                    type="text"
                    required
                    value={med.dosage}
                    onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all"
                    placeholder="e.g. 500mg"
                  />
                </td>

                {/* Frequency Input */}
                <td className="px-2 py-2">
                  <input
                    type="text"
                    required
                    value={med.frequency}
                    onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all"
                    placeholder="e.g. Twice daily"
                  />
                </td>

                {/* Duration Input */}
                <td className="px-2 py-2">
                  <input
                    type="text"
                    required
                    value={med.duration_text}
                    onChange={(e) => updateMedicine(index, 'duration_text', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0f766e] focus:bg-white rounded px-2 py-1.5 focus:outline-none transition-all"
                    placeholder="e.g. 5 days"
                  />
                </td>

                {/* Delete Button */}
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeMedicine(index)}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center justify-center mx-auto"
                    title="Remove medicine"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </td>
              </tr>
            ))}
            {medicines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                  No medicines added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={addMedicine}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer border border-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add</span> Add Medicine
        </button>
      </div>
    </div>
  );
}
