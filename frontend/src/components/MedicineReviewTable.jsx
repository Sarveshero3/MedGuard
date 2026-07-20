import React, { useState } from 'react';
import { InfoButton } from './InfoButton';

export function MedicineReviewTable({
  medicines,
  setMedicines,
  onResolveBrand,
  onShowInfo
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Use medicines prop directly (not function updaters) so the parent callback
  // in Upload.jsx always receives a plain array, not a function reference.
  const updateMedicine = (index, fieldOrObject, value) => {
    const updated = [...medicines];
    if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
      updated[index] = { ...updated[index], ...fieldOrObject };
    } else {
      updated[index] = { ...updated[index], [fieldOrObject]: value };
    }
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
      duration_text: '',
      duration_value: 1,
      duration_unit: 'day',
      is_lifetime: false
    }]);
  };

  const failedMedicines = medicines.filter(
    (med) => med.brand_name && med.generic_name === 'no such medicine found'
  );

  const handleRetryUnresolved = async () => {
    if (isRetrying || retryCount >= 5 || !onResolveBrand) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    const indicesToRetry = medicines
      .map((med, idx) => ({ med, idx }))
      .filter(({ med }) => med.brand_name && med.generic_name === 'no such medicine found')
      .map(({ idx }) => idx);

    try {
      await Promise.all(
        indicesToRetry.map((idx) => onResolveBrand(idx.idx, medicines[idx.idx].brand_name))
      );
    } catch (err) {
      console.error('Error during retry resolution:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar with Retry Button at Top Right */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <span>Extracted Medicines</span>
          {failedMedicines.length > 0 && (
            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full lowercase">
              {failedMedicines.length} unresolved
            </span>
          )}
        </h3>

        {failedMedicines.length > 0 && (
          <button
            type="button"
            disabled={isRetrying || retryCount >= 5}
            onClick={handleRetryUnresolved}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
              retryCount >= 5
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : isRetrying
                ? 'bg-teal-50 text-teal-700 border border-teal-200 cursor-wait'
                : 'bg-[#0f766e] hover:bg-[#0d645c] text-white cursor-pointer active:scale-95'
            }`}
            title={retryCount >= 5 ? 'Maximum 5 retries reached' : 'Retry research for unresolved brand names'}
          >
            <span className={`material-symbols-outlined text-sm ${isRetrying ? 'animate-spin' : ''}`}>
              {isRetrying ? 'sync' : 'replay'}
            </span>
            {isRetrying
              ? 'Researching...'
              : retryCount >= 5
              ? 'Max Retries Reached (5/5)'
              : `Retry Unresolved (${retryCount}/5)`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs text-slate-700 table-fixed">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 w-[150px]">Brand Name</th>
              <th className="px-3 py-2 w-[210px]">Generic Name</th>
              <th className="px-3 py-2 w-[90px]">
                <span className="flex items-center gap-1">Dosage
                  <InfoButton
                    onShowInfo={onShowInfo}
                    fieldName="Dosage"
                    description="The amount and strength of the medication per dose, as printed on the prescription."
                    example="500mg, 1 tablet, 5ml"
                  />
                </span>
              </th>
              <th className="px-3 py-2 w-[105px]">
                <span className="flex items-center gap-1">Frequency
                  <InfoButton
                    onShowInfo={onShowInfo}
                    fieldName="Frequency"
                    description="How often the medication should be taken per day or per week."
                    example="Twice daily, Once at bedtime, Every 8 hours"
                  />
                </span>
              </th>
              <th className="px-3 py-2 w-[185px]">
                <span className="flex items-center gap-1">Duration
                  <InfoButton
                    onShowInfo={onShowInfo}
                    fieldName="Duration"
                    description="The total period for which the medication is prescribed. Enter a number and select a unit (days/weeks/months/years), or check 'Lifetime' for ongoing medications."
                    example="5 days, 2 weeks, 3 months"
                  />
                </span>
              </th>
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

                {/* Generic Name - Read-Only Display (AI-generated, never user-editable) */}
                <td className="px-3 py-2">
                  <div className="break-words whitespace-normal max-w-[200px] leading-relaxed">
                    {med.generic_name === 'no such medicine found' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded px-2 py-0.5 font-semibold text-[10px]">
                          <span className="material-symbols-outlined text-xs">warning</span>
                          No such medicine found
                        </span>
                        {onResolveBrand && med.brand_name && retryCount < 5 && (
                          <button
                            type="button"
                            disabled={isRetrying}
                            onClick={() => {
                              setRetryCount((prev) => prev + 1);
                              onResolveBrand(index, med.brand_name);
                            }}
                            className="p-1 text-slate-400 hover:text-[#0f766e] hover:bg-teal-50 rounded transition-colors cursor-pointer"
                            title="Retry research for this medicine"
                          >
                            <span className="material-symbols-outlined text-xs font-bold">refresh</span>
                          </button>
                        )}
                      </div>
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

                {/* Duration — Lifetime only disables duration fields */}
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        required={!med.is_lifetime}
                        disabled={med.is_lifetime}
                        value={med.is_lifetime ? '' : (med.duration_value || '')}
                        onChange={(e) => updateMedicine(index, 'duration_value', e.target.value ? parseInt(e.target.value, 10) : '')}
                        className="w-12 bg-transparent border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded px-1 py-1 focus:outline-none transition-all text-center text-xs font-semibold disabled:opacity-50 disabled:bg-slate-50"
                        placeholder="e.g. 5"
                      />
                      <select
                        disabled={med.is_lifetime}
                        value={med.is_lifetime ? '' : (med.duration_unit || 'day')}
                        onChange={(e) => updateMedicine(index, 'duration_unit', e.target.value)}
                        className="bg-transparent border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded px-0.5 py-1 focus:outline-none transition-all text-[11px] disabled:opacity-50 disabled:bg-slate-50"
                      >
                        {med.is_lifetime && <option value=""></option>}
                        <option value="day">days</option>
                        <option value="week">weeks</option>
                        <option value="month">months</option>
                        <option value="year">years</option>
                      </select>
                    </div>

                    <div className="flex gap-2.5 mt-0.5">
                      <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer select-none font-medium">
                        <input
                          type="checkbox"
                          checked={!!med.is_lifetime}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (val) {
                              updateMedicine(index, {
                                is_lifetime: true,
                                duration_value: null,
                                duration_unit: null
                              });
                            } else {
                              updateMedicine(index, {
                                is_lifetime: false,
                                duration_value: 1,
                                duration_unit: 'day'
                              });
                            }
                          }}
                          className="accent-[#0f766e] h-3 w-3 cursor-pointer"
                        />
                        Lifetime
                      </label>
                    </div>
                  </div>
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
