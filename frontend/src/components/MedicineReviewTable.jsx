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

      {/* Mobile Card List (Visible < 768px) */}
      <div className="block md:hidden space-y-4">
        {medicines.map((med, index) => (
          <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-50 text-[#0f766e] text-xs font-bold flex items-center justify-center border border-teal-200">
                  {index + 1}
                </span>
                <span className="text-xs font-bold text-slate-700">Medicine #{index + 1}</span>
              </div>
              <button
                type="button"
                onClick={() => removeMedicine(index)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                title="Remove medicine"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>

            {/* Brand Name Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Brand Name</label>
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
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none transition-all"
                placeholder="e.g. Taxim O"
              />
            </div>

            {/* Generic / Composition */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Generic / Composition</label>
              {med.generic_name === 'no such medicine found' ? (
                <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <span className="text-rose-600 font-semibold text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
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
                      className="text-xs text-[#0f766e] font-bold underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : med.generic_name ? (
                <div className="bg-slate-100/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-bold text-xs leading-normal">
                  {med.generic_name}
                </div>
              ) : med.brand_name ? (
                <span className="text-[#0f766e] italic text-xs flex items-center gap-1.5 font-semibold py-1">
                  <span className="w-2 h-2 rounded-full bg-[#0f766e] animate-ping"></span>
                  Researching generic composition...
                </span>
              ) : (
                <span className="text-slate-400 italic text-xs block py-1">Enter brand name above</span>
              )}
            </div>

            {/* Dosage & Frequency Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Dosage</label>
                <input
                  type="text"
                  required
                  value={med.dosage}
                  onChange={(e) => {
                    updateMedicine(index, {
                      dosage: e.target.value,
                      is_ai_dosage: false
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none transition-all"
                  placeholder="e.g. 500mg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Frequency</label>
                <input
                  type="text"
                  required
                  value={med.frequency}
                  onChange={(e) => {
                    updateMedicine(index, {
                      frequency: e.target.value,
                      is_ai_frequency: false
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none transition-all"
                  placeholder="e.g. Twice daily"
                />
              </div>
            </div>

            {/* Duration Row */}
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duration</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  required={!med.is_lifetime}
                  disabled={med.is_lifetime}
                  value={med.is_lifetime ? '' : (med.duration_value || '')}
                  onChange={(e) => {
                    updateMedicine(index, {
                      duration_value: e.target.value ? parseInt(e.target.value, 10) : '',
                      is_ai_duration: false
                    });
                  }}
                  className="w-20 bg-slate-50 border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 text-center focus:outline-none disabled:opacity-50"
                  placeholder="e.g. 5"
                />
                <select
                  disabled={med.is_lifetime}
                  value={med.is_lifetime ? '' : (med.duration_unit || 'day')}
                  onChange={(e) => {
                    updateMedicine(index, {
                      duration_unit: e.target.value,
                      is_ai_duration: false
                    });
                  }}
                  className="bg-slate-50 border border-slate-200 focus:border-[#0f766e] focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none disabled:opacity-50"
                >
                  {med.is_lifetime && <option value=""></option>}
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                  <option value="year">years</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none font-semibold ml-auto">
                  <input
                    type="checkbox"
                    checked={!!med.is_lifetime}
                    onChange={(e) => {
                      const val = e.target.checked;
                      if (val) {
                        updateMedicine(index, {
                          is_lifetime: true,
                          duration_value: null,
                          duration_unit: null,
                          is_ai_duration: false
                        });
                      } else {
                        updateMedicine(index, {
                          is_lifetime: false,
                          duration_value: 1,
                          duration_unit: 'day',
                          is_ai_duration: false
                        });
                      }
                    }}
                    className="accent-[#0f766e] h-4 w-4 rounded cursor-pointer"
                  />
                  Lifetime
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View (Visible >= 768px) */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
        <table className="w-full text-left text-xs text-slate-700 table-fixed">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 w-[24%]">Brand Name</th>
              <th className="px-3 py-3 w-[14%]">Generic / Composition</th>
              <th className="px-3 py-3 w-[18%]">
                <span className="flex items-center gap-1">Dosage
                  <InfoButton
                    onShowInfo={onShowInfo}
                    fieldName="Dosage"
                    description="The amount and strength of the medication per dose, as printed on the prescription."
                    example="500mg, 1 tablet, 5ml"
                  />
                </span>
              </th>
              <th className="px-3 py-3 w-[18%]">
                <span className="flex items-center gap-1">Frequency
                  <InfoButton
                    onShowInfo={onShowInfo}
                    fieldName="Frequency"
                    description="How often the medication should be taken per day or per week."
                    example="Twice daily, Once at bedtime, Every 8 hours"
                  />
                </span>
              </th>
              <th className="px-3 py-3 w-[21%]">
                <span className="flex items-center gap-1">Duration
                  <InfoButton
                    onShowInfo={onShowInfo}
                    fieldName="Duration"
                    description="The total period for which the medication is prescribed. Enter a number and select a unit (days/weeks/months/years), or check 'Lifetime' for ongoing medications."
                    example="5 days, 2 weeks, 3 months"
                  />
                </span>
              </th>
              <th className="px-3 py-3 w-[5%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {medicines.map((med, index) => (
              <tr key={index} className="hover:bg-slate-50/70 transition-colors">
                {/* Brand Name Input */}
                <td className="px-2 py-3">
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

                {/* Generic Name / Composition - Compact 6-letter display with Tooltip */}
                <td className="px-3 py-3">
                  <div className="w-full leading-snug">
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
                      <span
                        className="text-slate-700 font-bold block text-[11px] truncate cursor-help bg-slate-100/70 border border-slate-200/60 rounded px-1.5 py-0.5 text-center font-mono"
                        title={med.generic_name}
                      >
                        {med.generic_name.trim().length > 6
                          ? `${med.generic_name.trim().substring(0, 6)}.....`
                          : med.generic_name.trim()}
                      </span>
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

                {/* Dosage Input with AI Recommendation Styling */}
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      required
                      value={med.dosage}
                      onChange={(e) => {
                        updateMedicine(index, {
                          dosage: e.target.value,
                          is_ai_dosage: false
                        });
                      }}
                      style={med.is_ai_dosage ? {
                        backgroundColor: 'var(--mg-ai-bg)',
                        borderColor: 'var(--mg-ai-border)',
                        color: 'var(--mg-ai-text)'
                      } : {}}
                      className={`w-full rounded px-2 py-1.5 text-xs font-medium focus:outline-none transition-all ${
                        med.is_ai_dosage
                          ? 'border shadow-2xs font-semibold'
                          : 'bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0f766e] focus:bg-white text-slate-800'
                      }`}
                      placeholder="e.g. 500mg"
                    />
                  </div>
                </td>

                {/* Frequency Input with AI Inferred Styling */}
                <td className="px-2 py-3">
                  <input
                    type="text"
                    required
                    value={med.frequency}
                    onChange={(e) => {
                      updateMedicine(index, {
                        frequency: e.target.value,
                        is_ai_frequency: false
                      });
                    }}
                    style={med.is_ai_frequency ? {
                      backgroundColor: 'var(--mg-ai-bg)',
                      borderColor: 'var(--mg-ai-border)',
                      color: 'var(--mg-ai-text)'
                    } : {}}
                    className={`w-full rounded px-2 py-1.5 text-xs font-medium focus:outline-none transition-all ${
                      med.is_ai_frequency
                        ? 'border shadow-2xs font-semibold'
                        : 'bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0f766e] focus:bg-white text-slate-800'
                    }`}
                    placeholder="e.g. Twice daily"
                  />
                </td>

                {/* Duration Input with AI Inferred Styling */}
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        required={!med.is_lifetime}
                        disabled={med.is_lifetime}
                        value={med.is_lifetime ? '' : (med.duration_value || '')}
                        onChange={(e) => {
                          updateMedicine(index, {
                            duration_value: e.target.value ? parseInt(e.target.value, 10) : '',
                            is_ai_duration: false
                          });
                        }}
                        style={med.is_ai_duration && !med.is_lifetime ? {
                          backgroundColor: 'var(--mg-ai-bg)',
                          borderColor: 'var(--mg-ai-border)',
                          color: 'var(--mg-ai-text)'
                        } : {}}
                        className={`w-14 rounded px-1.5 py-1 focus:outline-none transition-all text-center text-xs font-semibold disabled:opacity-50 disabled:bg-slate-50 ${
                          med.is_ai_duration && !med.is_lifetime
                            ? 'border shadow-2xs'
                            : 'bg-transparent border border-slate-200 focus:border-[#0f766e] focus:bg-white text-slate-800'
                        }`}
                        placeholder="e.g. 5"
                      />
                      <select
                        disabled={med.is_lifetime}
                        value={med.is_lifetime ? '' : (med.duration_unit || 'day')}
                        onChange={(e) => {
                          updateMedicine(index, {
                            duration_unit: e.target.value,
                            is_ai_duration: false
                          });
                        }}
                        style={med.is_ai_duration && !med.is_lifetime ? {
                          backgroundColor: 'var(--mg-ai-bg)',
                          borderColor: 'var(--mg-ai-border)',
                          color: 'var(--mg-ai-text)'
                        } : {}}
                        className={`rounded px-1 py-1 focus:outline-none transition-all text-[11px] font-medium disabled:opacity-50 disabled:bg-slate-50 ${
                          med.is_ai_duration && !med.is_lifetime
                            ? 'border'
                            : 'bg-transparent border border-slate-200 focus:border-[#0f766e] focus:bg-white text-slate-800'
                        }`}
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
                                duration_unit: null,
                                is_ai_duration: false
                              });
                            } else {
                              updateMedicine(index, {
                                is_lifetime: false,
                                duration_value: 1,
                                duration_unit: 'day',
                                is_ai_duration: false
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
                <td className="px-2 py-3 text-center">
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
          className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add</span> Add Medicine
        </button>
      </div>
    </div>
  );
}
