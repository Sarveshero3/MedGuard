import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useUploadQueue } from '../hooks/useUploadQueue'
import { buildPrescriptionPayload, buildLabReportPayload } from '../lib/payloadBuilders'
import { UploadQueueList } from '../components/UploadQueueList'
import { VisitLinkPanel } from '../components/VisitLinkPanel'
import { MedicineReviewTable } from '../components/MedicineReviewTable'
import { LabReportReviewForm } from '../components/LabReportReviewForm'

export default function Upload() {
  const { user, loading: authLoading, activePatientId } = useAuth()
  const navigate = useNavigate()
  const resolvingFilesRef = useRef(new Set())

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  const [docType, setDocType] = useState('prescription')

  const {
    uploadedFiles,
    setUploadedFiles,
    activeFileId,
    setActiveFileId,
    fileInputRef,
    triggerFileSelect,
    handleFileChange,
    handleUploadSingle,
    handleUploadAll,
    handleSkipToManual,
    handleRemoveFromQueue,
    duplicateFiles,
    setDuplicateFiles
  } = useUploadQueue(docType, activePatientId)

  const [isQueueCollapsed, setIsQueueCollapsed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Visit linking options for the currently active file review
  const [linkVisitOption, setLinkVisitOption] = useState('none') // 'none', 'existing', 'new'
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [newVisitData, setNewVisitData] = useState({
    doctor_name: '',
    specialty: '',
    disease_type: '',
    scheduled_date: '',
  })

  // Editable prescription medicines for the currently active file review
  const [prescriptionMedicines, setPrescriptionMedicines] = useState([])
  const [prescriptionDate, setPrescriptionDate] = useState(() => new Date().toISOString().split('T')[0])

  // Editable lab report fields for the currently active file review
  const [labFields, setLabFields] = useState({
    disease_type: '',
    recorded_at: '',
    panel_name: '',
  })
  const [labTests, setLabTests] = useState([])

  // State to hold the active file's extraction structure directly for UI helpers
  const [activeExtraction, setActiveExtraction] = useState(null)

  // Bottom info panel state for field help tooltips
  const [activeInfo, setActiveInfo] = useState(null)
  // Preview panel zoom level
  const [zoom, setZoom] = useState(1)
  // Guard ref to prevent form re-initialization on every uploadedFiles change
  const lastInitializedRef = useRef(null)

  // Helper to trigger brand resolutions on load for any missing generic names
  const resolveExtractedMeds = async (meds) => {
    if (!activeFileId) return;

    // 1. Ref guard to prevent concurrent resolution for the same fileId
    if (resolvingFilesRef.current.has(activeFileId)) {
      return;
    }
    resolvingFilesRef.current.add(activeFileId);

    try {
      // 2. Only resolve medicines that need resolution
      const needsResolution = meds.some(med =>
        med.brand_name &&
        (!med.generic_name || med.generic_name === 'no such medicine found' || med.generic_name === 'generic_unresolved')
      );
      if (!needsResolution) {
        return; // nothing to resolve, skip API calls
      }

      let updated = [...prescriptionMedicines];
      // If prescriptionMedicines is empty or length mismatch, use the passed meds
      if (updated.length !== meds.length) {
        updated = [...meds];
      }

      const batchSize = 3;
      for (let i = 0; i < meds.length; i += batchSize) {
        const chunk = meds.slice(i, i + batchSize);
        const promises = chunk.map(async (med, indexInChunk) => {
          const absoluteIndex = i + indexInChunk;

          // Layer of safety: don't overwrite if it is already resolved
          const currentMed = updated[absoluteIndex];
          const isAlreadyResolved = currentMed &&
            currentMed.generic_name &&
            currentMed.generic_name !== 'no such medicine found' &&
            currentMed.generic_name !== 'generic_unresolved';

          if (med.brand_name && !isAlreadyResolved) {
            try {
              const res = await api.post('/medicines/resolve-brand', { brand_name: med.brand_name });
              const resolved = res.data.generic_name || 'no such medicine found';
              const recommended = res.data.recommended_dosage || '';
              return { index: absoluteIndex, generic_name: resolved, recommended_dosage: recommended };
            } catch (e) {
              return { index: absoluteIndex, generic_name: 'no such medicine found', recommended_dosage: '' };
            }
          }
          return null;
        });

        const results = await Promise.allSettled(promises);
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            const { index, generic_name, recommended_dosage } = result.value;
            // Additional layer of safety: once resolved, never overwrite it
            const currentMed = updated[index];
            const isAlreadyResolved = currentMed &&
              currentMed.generic_name &&
              currentMed.generic_name !== 'no such medicine found' &&
              currentMed.generic_name !== 'generic_unresolved';

            if (!isAlreadyResolved) {
              const currentDosage = currentMed?.dosage || '';
              const shouldImputeDosage = !currentDosage.trim() && recommended_dosage;

              updated[index] = {
                ...updated[index],
                generic_name,
                original_generic_name: generic_name,
                ...(shouldImputeDosage ? { dosage: recommended_dosage, is_ai_dosage: true } : {})
              };
            }
          }
        });
      }

      setPrescriptionMedicines(updated);
      setUploadedFiles(queue => queue.map(f => f.id === activeFileId ? {
        ...f,
        extraction: {
          ...f.extraction,
          raw_extraction: {
            ...f.extraction.raw_extraction,
            medicines: updated
          }
        }
      } : f));
    } finally {
      // Clear from resolving set when completed
      resolvingFilesRef.current.delete(activeFileId);
    }
  };

  const handleResolveBrand = async (index, brandName) => {
    if (!brandName.trim()) return;
    try {
      const res = await api.post('/medicines/resolve-brand', { brand_name: brandName });
      const generic_name = res.data.generic_name || 'no such medicine found';
      const recommended_dosage = res.data.recommended_dosage || '';

      setPrescriptionMedicines(prev => {
        const updated = [...prev];
        if (updated[index]) {
          const currentDosage = updated[index].dosage || '';
          const shouldImputeDosage = !currentDosage.trim() && recommended_dosage;
          updated[index] = {
            ...updated[index],
            generic_name,
            original_generic_name: generic_name,
            ...(shouldImputeDosage ? { dosage: recommended_dosage, is_ai_dosage: true } : {})
          };
        }
        setUploadedFiles(queue => queue.map(f => f.id === activeFileId ? {
          ...f,
          extraction: {
            ...f.extraction,
            raw_extraction: {
              ...f.extraction.raw_extraction,
              medicines: updated
            }
          }
        } : f));
        return updated;
      });
    } catch (err) {
      console.error('Error resolving brand:', err);
      setPrescriptionMedicines(prev => {
        const updated = prev.map((m, idx) => idx === index ? { ...m, generic_name: 'no such medicine found', original_generic_name: 'no such medicine found' } : m);
        setUploadedFiles(queue => queue.map(f => f.id === activeFileId ? {
          ...f,
          extraction: {
            ...f.extraction,
            raw_extraction: {
              ...f.extraction.raw_extraction,
              medicines: updated
            }
          }
        } : f));
        return updated;
      });
    }
  };

  // Helper to calculate mode of extracted duration_value and impute missing dosage/duration
  const imputeMissingFields = (meds) => {
    if (!Array.isArray(meds) || meds.length === 0) return meds;

    // 1. Collect all non-null, non-zero, non-lifetime duration values
    const extractedDurations = meds
      .map(m => m.duration_value)
      .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)) && Number(val) > 0);

    let modeDuration = 1;
    if (extractedDurations.length > 0) {
      const freqMap = {};
      let maxFreq = 0;
      extractedDurations.forEach(val => {
        const num = Number(val);
        freqMap[num] = (freqMap[num] || 0) + 1;
        if (freqMap[num] > maxFreq) {
          maxFreq = freqMap[num];
          modeDuration = num;
        }
      });
    }

    return meds.map(med => {
      let is_ai_duration = !!med.is_ai_duration;
      let duration_value = med.duration_value;
      let duration_unit = med.duration_unit;

      // If duration is missing and not lifetime
      if (!med.is_lifetime && (duration_value === null || duration_value === undefined || duration_value === '')) {
        duration_value = modeDuration;
        duration_unit = duration_unit || 'day';
        is_ai_duration = true;
      }

      let is_ai_dosage = !!med.is_ai_dosage;
      let dosage = med.dosage || '';

      if (!dosage.trim() && med.recommended_dosage) {
        dosage = med.recommended_dosage;
        is_ai_dosage = true;
      }

      return {
        ...med,
        dosage,
        duration_value,
        duration_unit,
        is_ai_duration,
        is_ai_dosage
      };
    });
  };

  // Initialize form fields helper
  const initializeFormFields = (type, data) => {
    const raw = data?.raw_extraction || {}
    const defaultDate = new Date().toISOString().split('T')[0];
    if (type === 'prescription') {
      setPrescriptionDate(defaultDate);
      if (raw.medicines && Array.isArray(raw.medicines)) {
        const initialMeds = raw.medicines.map(m => ({
          brand_name: m.brand_name || '',
          generic_name: m.generic_name || '',
          original_generic_name: m.original_generic_name || m.generic_name || '',
          dosage: m.dosage || '',
          frequency: m.frequency || '',
          duration_text: m.duration_text || '',
          duration_value: m.duration_value !== undefined ? m.duration_value : null,
          duration_unit: m.duration_unit || null,
          is_lifetime: !!m.is_lifetime,
          is_ai_duration: !!m.is_ai_duration,
          is_ai_dosage: !!m.is_ai_dosage
        }));
        const imputed = imputeMissingFields(initialMeds);
        setPrescriptionMedicines(imputed);
        resolveExtractedMeds(imputed);
      } else {
        const initialMeds = [{
          brand_name: raw.brand_name || '',
          generic_name: data?.resolution?.generic_name || '',
          original_generic_name: raw.original_generic_name || data?.resolution?.generic_name || '',
          dosage: raw.dosage || '',
          frequency: raw.frequency || '',
          duration_text: raw.duration_text || '',
          duration_value: raw.duration_value !== undefined ? raw.duration_value : null,
          duration_unit: raw.duration_unit || null,
          is_lifetime: !!raw.is_lifetime,
          is_ai_duration: !!raw.is_ai_duration,
          is_ai_dosage: !!raw.is_ai_dosage
        }];
        const imputed = imputeMissingFields(initialMeds);
        setPrescriptionMedicines(imputed);
        resolveExtractedMeds(imputed);
      }
    } else {
      let parsedTests = [];
      if (raw.tests && Array.isArray(raw.tests)) {
        parsedTests = raw.tests.map(t => ({
          test_type: t.test_type || '',
          panel_name: t.panel_name || raw.panel_name || '',
          value: t.value || '',
          unit: t.unit || '',
          ref_range: t.ref_range || ''
        }));
      } else if (raw.test_type || raw.value) {
        // Fallback for legacy format
        parsedTests = [{
          test_type: raw.test_type || '',
          panel_name: raw.panel_name || '',
          value: raw.value || '',
          unit: raw.unit || '',
          ref_range: ''
        }];
      }
      setLabTests(parsedTests);
      setLabFields({
        disease_type: raw.disease_type || '',
        recorded_at: raw.recorded_at || defaultDate,
        panel_name: raw.panel_name || ''
      });
    }

    if (data?.proposed_visit_id) {
      setLinkVisitOption('existing')
      setSelectedVisitId(data.proposed_visit_id)
    } else if (data?.candidate_visits && data.candidate_visits.length > 0) {
      setLinkVisitOption('existing')
      setSelectedVisitId(data.candidate_visits[0].id)
    } else {
      setLinkVisitOption('none')
    }
  }

  // Update form fields when active file changes or when extraction first completes.
  // CRITICAL FIX: This must NOT re-fire on every uploadedFiles change (which happens
  // on each keystroke due to the form-to-queue sync). The lastInitializedRef guard
  // ensures initializeFormFields only runs when the file ID or completion status
  // actually changes — preventing the "table wipes on edit" bug.
  useEffect(() => {
    if (!activeFileId) {
      setActiveExtraction(null);
      setActiveInfo(null);
      setZoom(1);
      return;
    }

    const activeItem = uploadedFiles.find(f => f.id === activeFileId);
    if (activeItem && activeItem.status === 'completed' && activeItem.extraction) {
      const initKey = `${activeFileId}:completed`;
      if (lastInitializedRef.current !== initKey) {
        lastInitializedRef.current = initKey;
        setActiveExtraction(activeItem.extraction);
        initializeFormFields(activeItem.docType, activeItem.extraction);
        setIsQueueCollapsed(true);
        setActiveInfo(null);
        setZoom(1);
      }
    } else {
      setActiveExtraction(null);
    }
  }, [activeFileId, uploadedFiles]);

  const handleSaveActive = async (e) => {
    e.preventDefault()
    if (!activeFileId) return

    const activeItem = uploadedFiles.find(f => f.id === activeFileId)
    if (!activeItem || !activeItem.extraction) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      let finalVisitId = null

      // 1. Create a new visit if user selected inline creation
      if (linkVisitOption === 'new') {
        if (!newVisitData.scheduled_date) {
          throw new Error('Please select an appointment date for the new visit.')
        }
        const visitRes = await api.post('/calendar/visits', {
          patient_id: activePatientId,
          doctor_name: newVisitData.doctor_name,
          specialty: newVisitData.specialty,
          scheduled_date: newVisitData.scheduled_date,
          disease_type: activeItem.docType === 'lab_report' ? labFields.disease_type : newVisitData.disease_type,
        })
        finalVisitId = visitRes.data.data.id
      } else if (linkVisitOption === 'existing') {
        finalVisitId = selectedVisitId
      }

      // 2. Submit confirmation payload
      if (activeItem.docType === 'prescription') {
        const medsWithDate = prescriptionMedicines.map(m => ({
          ...m,
          added_at: prescriptionDate
        }))
        const payload = buildPrescriptionPayload(activePatientId, finalVisitId, medsWithDate, activeItem)
        await api.post('/medicines/batch', payload)
      } else {
        const payload = buildLabReportPayload(activePatientId, finalVisitId, labTests, labFields, activeItem)
        await api.post('/lab-reports/confirm', payload)
      }

      setSuccess('✔ Clinical record successfully confirmed and saved!')
      setActiveInfo(null)

      // Update queue item state to saved
      setUploadedFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, saved: true } : f))

      // Select the next completed & unsaved file in the queue
      setTimeout(() => {
        setSuccess('')
        const nextItem = uploadedFiles.find(f => f.id !== activeFileId && f.status === 'completed' && !f.saved)
        if (nextItem) {
          setActiveFileId(nextItem.id)
        } else {
          // If no more items to review, check if batch is complete
          const allDone = uploadedFiles.every(f => f.saved || f.id === activeFileId)
          if (allDone) {
            setSaved(true)
            setTimeout(() => {
              navigate(activeItem.docType === 'prescription' ? '/medicines' : '/dashboard')
            }, 1500)
          }
        }
      }, 1500)

    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to save clinical record')
    } finally {
      setSaving(false)
    }
  }

  const getConfidenceBadge = (score) => {
    if (score >= 0.85) {
      return <span className="bg-emerald-50 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded border border-emerald-100">High Confidence</span>
    }
    if (score >= 0.70) {
      return <span className="bg-amber-50 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded border border-amber-100">Verify Value</span>
    }
    return <span className="bg-rose-50 text-rose-800 text-xs font-semibold px-2 py-0.5 rounded border border-rose-100">Low Confidence</span>
  }

  return (
    <>
      <main className="flex-grow flex flex-col items-center py-16 px-6 md:px-16 w-full max-w-[1440px] mx-auto animate-fade-in text-left">

        {/* Header */}
        <header className="mb-12 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Clinical Upload Center</h1>
            <p className="text-sm text-slate-500">
              Digitize clinical prescriptions and lab analysis reports for safety checks and trend monitoring.
            </p>
          </div>
        </header>

        {/* Workspace Card */}
        <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-6 md:p-10 shadow-sm">

          {error && (
            <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-8 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              {success}
            </div>
          )}

          {saved && (
            <div className="mb-8 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              ✔ Batch review completed! Redirecting...
            </div>
          )}

          {/* Hidden multi-file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            multiple
            className="hidden"
          />

          {/* STEP 1: Upload Dropzone (When Queue is Empty) */}
          {uploadedFiles.length === 0 && (
            <div className="flex flex-col items-center">
              <div
                onClick={triggerFileSelect}
                className="w-full max-w-3xl border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[400px] hover:border-slate-400 hover:bg-slate-50/50 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-6xl text-slate-400 mb-6">upload_file</span>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Upload Medical Documents
                </h3>
                <p className="text-sm text-slate-500 mb-8">Drag &amp; drop images or PDF files here, or click to browse</p>

                <div className="flex gap-4 mt-6" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={triggerFileSelect}
                    className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-sm px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    Select Files
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-8">Accepts prescriptions and lab reports. JPG, JPEG, PNG, PDF — max 8MB. Multiple files supported.</p>
              </div>
            </div>
          )}

          {/* STEP 2 & 3: Batch Queue Workspace (When Queue Has Items) */}
          {uploadedFiles.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">

              {/* Left Column: File Queue */}
              <UploadQueueList
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                activeFileId={activeFileId}
                setActiveFileId={setActiveFileId}
                handleUploadAll={handleUploadAll}
                handleRemoveFromQueue={handleRemoveFromQueue}
                triggerFileSelect={triggerFileSelect}
                isCollapsed={isQueueCollapsed}
                setIsCollapsed={setIsQueueCollapsed}
              />

              {/* Right Column: Review Form / Action Area */}
              <div className={isQueueCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'}>
                {activeFileId ? (
                  (() => {
                    const activeItem = uploadedFiles.find(f => f.id === activeFileId);
                    if (!activeItem) return null;

                    // 1. Idle state
                    if (activeItem.status === 'idle') {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 border border-slate-200 border-dashed rounded-2xl bg-slate-50/50 min-h-[400px] text-center">
                          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 animate-bounce">rocket_launch</span>
                          <h3 className="text-lg font-bold text-slate-800 mb-2">Extraction Pending</h3>
                          <p className="text-sm text-slate-500 mb-8 max-w-sm">
                            Extract content from "{activeItem.name}" using dual-model character validation.
                          </p>
                          <div className="mb-8 w-full max-w-xs text-left mx-auto">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Document Type</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFiles(prev => prev.map(f => f.id === activeItem.id ? { ...f, docType: 'prescription' } : f))
                                }}
                                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeItem.docType === 'prescription'
                                    ? 'bg-[#0f766e] text-white shadow-sm'
                                    : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                  }`}
                              >
                                Prescription
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFiles(prev => prev.map(f => f.id === activeItem.id ? { ...f, docType: 'lab_report' } : f))
                                }}
                                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeItem.docType === 'lab_report'
                                    ? 'bg-[#0f766e] text-white shadow-sm'
                                    : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                  }`}
                              >
                                Lab Report
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button
                              onClick={() => handleUploadSingle(activeItem.id)}
                              className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">rocket_launch</span> Extract Now
                            </button>
                            <button
                              onClick={() => handleSkipToManual(activeItem.id)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold cursor-pointer"
                            >
                              Skip to Manual Entry
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 2. Uploading / processing states
                    if (activeItem.status === 'uploading' || activeItem.status === 'processing') {
                      const msg = activeItem.progressMessage || '';

                      const steps = [
                        { id: 1, label: 'Document Ingestion & Checksum Verification', status: msg !== 'Uploading to server...' ? 'completed' : 'active' },
                        { id: 2, label: 'Text Extraction & Character Parsing (OCR)', status: (msg === 'Analyzing document structure...' || msg === 'Extracting fields...') ? 'active' : (msg !== 'Uploading to server...' ? 'completed' : 'pending') },
                        { id: 3, label: 'Dual-Model Consensus Extraction (Model A & B)', status: msg === 'Analyzing document structure...' ? 'active' : (msg === 'Extracting fields...' || msg === 'Ready for review' ? 'completed' : 'pending') },
                        { id: 4, label: 'Multi-Pass Critique & Safety Research', status: msg === 'Analyzing document structure...' ? 'pending' : (msg === 'Extracting fields...' ? 'active' : 'pending') },
                        { id: 5, label: 'Compiling Final Resolution Verification Review', status: msg === 'Ready for review' ? 'completed' : 'pending' }
                      ];

                      if (msg === 'Enqueued in pipeline...') {
                        steps[0].status = 'completed';
                        steps[1].status = 'active';
                      }

                      return (
                        <div className="flex flex-col items-center justify-center p-8 border border-slate-200 rounded-2xl bg-white min-h-[420px] shadow-sm text-left max-w-xl mx-auto w-full">
                          <div className="flex items-center gap-3 mb-6 w-full border-b border-slate-100 pb-4">
                            <span className="material-symbols-outlined text-2xl text-[#0f766e] animate-pulse">clinical_research</span>
                            <div>
                              <h3 className="text-sm font-bold text-slate-800">Clinical Agent Research Active</h3>
                              <p className="text-[10px] text-slate-500">Groq Consensus & Literature Search Loop</p>
                            </div>
                          </div>

                          <div className="space-y-5 w-full mb-6">
                            {steps.map((step) => (
                              <div key={step.id} className="flex items-start gap-4">
                                <div className="flex-shrink-0 mt-0.5">
                                  {step.status === 'completed' && (
                                    <span className="material-symbols-outlined text-emerald-500 font-bold text-lg">check_circle</span>
                                  )}
                                  {step.status === 'active' && (
                                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#0f766e] animate-spin"></div>
                                  )}
                                  {step.status === 'pending' && (
                                    <div className="w-4 h-4 rounded-full border-2 border-slate-200"></div>
                                  )}
                                </div>
                                <div className="flex-grow">
                                  <p className={`text-xs font-semibold ${step.status === 'completed' ? 'text-slate-800' : step.status === 'active' ? 'text-[#0f766e] font-bold' : 'text-slate-400'}`}>
                                    {step.label}
                                  </p>
                                  {step.status === 'active' && (
                                    <span className="text-[10px] text-slate-400 block mt-0.5 animate-pulse font-medium">Agent invoking Groq...</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
                            <div className="bg-[#0f766e] h-full transition-all duration-500" style={{
                              width: msg === 'Uploading to server...' ? '15%' :
                                msg === 'Enqueued in pipeline...' ? '35%' :
                                  msg === 'Analyzing document structure...' ? '65%' :
                                    msg === 'Extracting fields...' ? '85%' : '95%'
                            }}></div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono self-end">{msg}</span>
                        </div>
                      );
                    }

                    // 3. Failed state
                    if (activeItem.status === 'failed') {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 border border-red-200 rounded-2xl bg-red-50/10 min-h-[400px] text-center">
                          <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error</span>
                          <h3 className="text-lg font-bold text-red-700 mb-1">Extraction Failed</h3>
                          <p className="text-xs text-red-600 mb-6 max-w-sm">
                            {activeItem.progressMessage}
                          </p>
                          <div className="flex gap-4">
                            <button
                              onClick={() => handleUploadSingle(activeItem.id)}
                              className="!bg-red-600 hover:!bg-red-700 !text-white font-semibold text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 border border-red-700/30"
                            >
                              <span className="material-symbols-outlined text-xs">replay</span> Retry Upload
                            </button>
                            <button
                              onClick={() => handleSkipToManual(activeItem.id)}
                              className="text-xs !bg-slate-100 hover:!bg-slate-200 !text-slate-700 px-4 py-2.5 rounded-xl font-semibold cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 border border-slate-200"
                            >
                              Fill Manually
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 4. Saved state
                    if (activeItem.saved) {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 border border-slate-200 rounded-2xl bg-white min-h-[400px] shadow-sm text-center">
                          <span className="material-symbols-outlined text-5xl text-emerald-600 mb-4">check_circle</span>
                          <h3 className="text-lg font-bold text-slate-800 mb-1">Clinical Record Saved</h3>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto">
                            The details of "{activeItem.name}" have been verified and linked successfully.
                          </p>
                        </div>
                      );
                    }

                    // 5. Completed review form
                    if (activeItem.status === 'completed' && activeExtraction) {
                      const hasAiFields = activeItem.docType === 'prescription' && prescriptionMedicines.some(m => m.is_ai_dosage || m.is_ai_duration);

                      return (
                        <div className="flex flex-col w-full text-left">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                              <h2 className="text-xl font-bold text-slate-800">Review Extraction: {activeItem.name}</h2>
                              <span className="bg-amber-50 border border-amber-200 text-amber-850 font-semibold text-xs px-2.5 py-0.5 rounded-md">
                                Review Required
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {hidePreview && (
                                <button
                                  type="button"
                                  onClick={() => setHidePreview(false)}
                                  className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="Show Document Preview Panel"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility</span>
                                  <span>Show Document</span>
                                </button>
                              )}

                              {activeItem.docType === 'prescription' && (
                                <div className="flex items-center gap-3 border border-slate-200 bg-slate-50/50 rounded-xl px-4 py-2 text-xs">
                                  <label htmlFor="prescription_date_top" className="font-bold text-slate-500 uppercase tracking-wider">
                                    Prescription Date
                                  </label>
                                  <input
                                    id="prescription_date_top"
                                    type="date"
                                    required
                                    value={prescriptionDate}
                                    onChange={(e) => setPrescriptionDate(e.target.value)}
                                    className="bg-white border border-slate-200 focus:border-[#0f766e] rounded px-3 py-1.5 focus:outline-none transition-all font-semibold text-slate-800"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {activeExtraction.needs_follow_up && (
                            <div className="mb-6 p-4 bg-sky-50 border-l-4 border-sky-500 text-sky-800 text-xs rounded-r-lg">
                              <strong className="block mb-1 font-bold">Extraction Validation Mismatch:</strong>
                              {activeExtraction.follow_up_question}
                            </div>
                          )}

                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                            {/* Left: Document View Panel */}
                            {!hidePreview && (
                              <div className="xl:col-span-4 self-start flex flex-col border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
                                <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center text-xs text-slate-500 font-semibold">
                                  <span>Preview Panel</span>
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer" title="Zoom Out">
                                      <span className="material-symbols-outlined text-sm">zoom_out</span>
                                    </button>
                                    <span className="text-[10px] font-mono min-w-[3ch] text-center select-none">{Math.round(zoom * 100)}%</span>
                                    <button type="button" onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer" title="Zoom In">
                                      <span className="material-symbols-outlined text-sm">zoom_in</span>
                                    </button>
                                    <button type="button" onClick={() => setZoom(1)} className="p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer" title="Reset Zoom">
                                      <span className="material-symbols-outlined text-sm">fit_screen</span>
                                    </button>
                                    <span className="text-slate-300 mx-0.5">|</span>
                                    <button
                                      type="button"
                                      onClick={() => setHidePreview(true)}
                                      className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                                      title="Hide Document Preview"
                                    >
                                      <span className="material-symbols-outlined text-sm">visibility_off</span>
                                      <span>Hide</span>
                                    </button>
                                  </div>
                                </div>
                                <div className="p-4 overflow-auto max-h-[550px] bg-slate-150">
                                  <div style={{ width: `${zoom * 100}%`, transformOrigin: 'top left' }}>
                                    {activeItem.isPdf ? (
                                      <object
                                        data={activeItem.base64}
                                        type="application/pdf"
                                        style={{ width: '100%', minHeight: `${450 * zoom}px` }}
                                        className="rounded border border-slate-200 shadow-sm"
                                      >
                                        <div className="flex flex-col items-center justify-center text-center gap-3 p-8">
                                          <span className="material-symbols-outlined text-6xl text-rose-500">picture_as_pdf</span>
                                          <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={activeItem.name}>
                                            {activeItem.name}
                                          </span>
                                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-semibold uppercase">
                                            PDF Preview Unavailable
                                          </span>
                                        </div>
                                      </object>
                                    ) : (
                                      <img className="object-contain w-full rounded border border-slate-200 shadow-sm" src={activeItem.preview || activeItem.base64} alt="Document preview" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Right: Validation Forms */}
                            <form onSubmit={handleSaveActive} className={hidePreview ? "xl:col-span-12 space-y-5" : "xl:col-span-8 space-y-5"}>

                              {/* Section 11.C Disclaimer Banner */}
                              {hasAiFields && (
                                <div
                                  className="p-4 mb-4 rounded-xl flex items-start gap-3 border shadow-xs transition-all"
                                  style={{
                                    backgroundColor: 'var(--mg-ai-bg)',
                                    borderColor: 'var(--mg-ai-border)',
                                    color: 'var(--mg-ai-text)'
                                  }}
                                >
                                  <span className="material-symbols-outlined text-lg mt-0.5 flex-shrink-0">auto_awesome</span>
                                  <div className="text-xs leading-relaxed">
                                    <strong className="font-bold block mb-0.5">AI-Suggested Values Present:</strong>
                                    Highlighted fields (dosage or duration) were AI-suggested or calculated from prescription averages. Please verify and confirm all values before saving.
                                  </div>
                                </div>
                              )}

                              {activeItem.needsClassificationConfirmation ? (
                                <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl mb-6 text-left shadow-sm">
                                  <h4 className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-base">question_mark</span>
                                    Confirm Document Type
                                  </h4>
                                  <p className="text-xs text-amber-700 mb-4 leading-relaxed">
                                    MedGuard classified this document as a <strong>{activeItem.docType === 'prescription' ? 'Prescription' : 'Lab Report'}</strong> with low confidence ({((activeItem.classificationConfidence || 0.5) * 100).toFixed(0)}%). Please confirm the correct document type to load the verification form.
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUploadedFiles(prev => prev.map(f => f.id === activeItem.id ? {
                                          ...f,
                                          needsClassificationConfirmation: false
                                        } : f))
                                      }}
                                      className="bg-amber-800 hover:bg-amber-900 text-white font-semibold text-[10px] px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm uppercase tracking-wider"
                                    >
                                      Correct, it's a {activeItem.docType === 'prescription' ? 'Prescription' : 'Lab Report'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newDocType = activeItem.docType === 'prescription' ? 'lab_report' : 'prescription';
                                        setUploadedFiles(prev => prev.map(f => f.id === activeItem.id ? {
                                          ...f,
                                          docType: newDocType,
                                          needsClassificationConfirmation: false
                                        } : f))
                                      }}
                                      className="bg-white hover:bg-amber-100/50 text-amber-800 border border-amber-300 font-semibold text-[10px] px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm uppercase tracking-wider"
                                    >
                                      Incorrect, it's a {activeItem.docType === 'prescription' ? 'Lab Report' : 'Prescription'}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {activeItem.docType === 'prescription' ? (
                                <MedicineReviewTable
                                  medicines={prescriptionMedicines}
                                  setMedicines={(updated) => {
                                    setPrescriptionMedicines(updated);
                                    setUploadedFiles(queue => queue.map(f => f.id === activeFileId ? {
                                      ...f,
                                      extraction: {
                                        ...f.extraction,
                                        raw_extraction: {
                                          ...f.extraction.raw_extraction,
                                          medicines: updated
                                        }
                                      }
                                    } : f));
                                  }}
                                  onResolveBrand={handleResolveBrand}
                                  onShowInfo={setActiveInfo}
                                />
                              ) : (
                                <LabReportReviewForm
                                  labFields={labFields}
                                  setLabFields={setLabFields}
                                  labTests={labTests}
                                  setLabTests={(updated) => {
                                    setLabTests(updated);
                                    setUploadedFiles(queue => queue.map(f => f.id === activeFileId ? {
                                      ...f,
                                      extraction: {
                                        ...f.extraction,
                                        raw_extraction: {
                                          ...f.extraction.raw_extraction,
                                          tests: updated
                                        }
                                      }
                                    } : f));
                                  }}
                                  confidenceScores={activeExtraction?.confidence_scores}
                                  getConfidenceBadge={getConfidenceBadge}
                                  onShowInfo={setActiveInfo}
                                />
                              )}

                              {/* Visit Proximity linking */}
                              <VisitLinkPanel
                                activeExtraction={activeExtraction}
                                linkVisitOption={linkVisitOption}
                                setLinkVisitOption={setLinkVisitOption}
                                selectedVisitId={selectedVisitId}
                                setSelectedVisitId={setSelectedVisitId}
                                newVisitData={newVisitData}
                                setNewVisitData={setNewVisitData}
                              />

                              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                  type="submit"
                                  disabled={saving}
                                  className="!bg-[#0f766e] hover:!bg-[#0d645c] !text-white font-semibold text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border-0 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
                                >
                                  <span className="material-symbols-outlined text-sm">verified</span>
                                  {saving ? 'Saving...' : 'Save & Link Records'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 border border-slate-200 border-dashed rounded-2xl bg-slate-50/50 min-h-[400px] text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 animate-pulse">touch_app</span>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">No File Selected</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Select a clinical document from the queue on the left to begin validation.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200">
        <div className="w-full py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1200px] mx-auto text-sm text-slate-500">
          <div className="font-serif text-lg font-bold text-slate-900 mb-4 md:mb-0">
            MedGuard
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy-policy" className="hover:text-[#0F766E] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#0F766E] transition-colors">Terms of Service</Link>
            <Link to="/clinical-guidelines" className="hover:text-[#0F766E] transition-colors">Clinical Guidelines</Link>
            <Link to="/support" className="hover:text-[#0F766E] transition-colors">Contact Support</Link>
          </div>
          <div className="text-xs text-slate-400 mt-4 md:mt-0">
            © 2026 MedGuard AI. Clinical Excellence in Medication Safety.
          </div>
        </div>
      </footer>

      {/* Bottom docked field info panel */}
      {activeInfo && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-up">
          <div className="max-w-3xl mx-auto bg-white text-[#0b1f33] rounded-t-2xl shadow-[0_-8px_24px_rgba(11,31,51,0.06)] border border-slate-200/80 border-b-0 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-grow min-w-0 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#0f766e] text-lg font-bold">info</span>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#0b1f33]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {activeInfo.fieldName}
                  </h4>
                </div>
                <p className="text-[13px] text-[#5d6b78] leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {activeInfo.description}
                </p>
                {activeInfo.example && (
                  <div className="mt-4 bg-[#f4f8f8] border border-slate-200/40 rounded-xl px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#5d6b78] uppercase tracking-wider select-none" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Example:
                    </span>
                    <span className="text-[#0b1f33] font-mono text-xs font-semibold">{activeInfo.example}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveInfo(null)}
                className="text-slate-400 hover:text-[#0b1f33] p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate warning themed modal */}
      {duplicateFiles && duplicateFiles.length > 0 && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full text-center flex flex-col items-center animate-scale-up relative transform transition-all">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4">
              <span className="material-symbols-outlined text-2xl font-bold">warning</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Duplicate File Selected</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              The following file(s) have already been uploaded to the workspace queue:
            </p>
            <div className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-3 mb-5 max-h-24 overflow-y-auto text-left">
              <ul className="list-disc list-inside text-xs font-mono text-slate-700 space-y-1">
                {duplicateFiles.map((name, i) => (
                  <li key={i} className="truncate">{name}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateFiles([])}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer transition-all shadow-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
