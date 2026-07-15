import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'

export default function Upload() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])
  
  // Document type switcher for new files to add: 'prescription' or 'lab_report'
  const [docType, setDocType] = useState('prescription')
  
  // Batch Queue States
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [activeFileId, setActiveFileId] = useState(null)
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  // Visit linking options for the currently active file review
  const [linkVisitOption, setLinkVisitOption] = useState('none') // 'none', 'existing', 'new'
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [newVisitData, setNewVisitData] = useState({
    doctor_name: '',
    specialty: '',
    disease_type: '',
    scheduled_date: '',
  })

  // Editable prescription fields for the currently active file review
  const [prescriptionFields, setPrescriptionFields] = useState({
    brand_name: '',
    dosage: '',
    frequency: '',
    duration_text: '',
    course_end_date: '',
  })

  // Editable lab report fields for the currently active file review
  const [labFields, setLabFields] = useState({
    test_type: '',
    panel_name: '',
    value: '',
    unit: '',
    disease_type: '',
  })

  // State to hold the active file's extraction structure directly for UI helpers
  const [activeExtraction, setActiveExtraction] = useState(null)

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length > 0) {
      const newItems = selectedFiles.map(file => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        return {
          id: Math.random().toString(36).substring(7),
          file,
          name: file.name,
          preview: isPdf ? null : URL.createObjectURL(file),
          isPdf,
          status: 'idle',
          progressMessage: 'Ready to extract',
          extraction: null,
          saved: false,
          docType: docType
        };
      });
      setUploadedFiles(prev => [...prev, ...newItems]);
      setError('');
      setSuccess('');
      
      // Auto-activate the first newly added file if there isn't an active one
      if (!activeFileId && newItems.length > 0) {
        setActiveFileId(newItems[0].id);
      }
    }
    // Reset file input so same file can be selected again
    e.target.value = '';
  }

  // Initialize form fields helper
  const initializeFormFields = (type, data) => {
    const raw = data?.raw_extraction || {}
    if (type === 'prescription') {
      setPrescriptionFields({
        brand_name: raw.brand_name || '',
        dosage: raw.dosage || '',
        frequency: raw.frequency || '',
        duration_text: raw.duration_text || '',
        course_end_date: '',
      })
    } else {
      setLabFields({
        test_type: raw.test_type || '',
        panel_name: raw.panel_name || '',
        value: raw.value || '',
        unit: raw.unit || '',
        disease_type: '',
      })
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

  // Update form fields when active file changes or updates
  useEffect(() => {
    if (!activeFileId) {
      setActiveExtraction(null);
      return;
    }
    
    const activeItem = uploadedFiles.find(f => f.id === activeFileId);
    if (activeItem && activeItem.status === 'completed' && activeItem.extraction) {
      setActiveExtraction(activeItem.extraction);
      initializeFormFields(activeItem.docType, activeItem.extraction);
    } else {
      setActiveExtraction(null);
    }
  }, [activeFileId, uploadedFiles]);

  const handleUploadSingle = async (fileId) => {
    const item = uploadedFiles.find(f => f.id === fileId)
    if (!item || item.status !== 'idle') return

    // Mark as uploading
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'uploading', progressMessage: 'Uploading to server...' } : f))

    const formData = new FormData()
    formData.append('photo', item.file)
    if (user) {
      formData.append('patient_id', user.id)
    }

    const endpoint = item.docType === 'prescription' ? '/medicines/upload' : '/lab-reports/upload'

    try {
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      const { jobId } = res.data.data
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, jobId, status: 'processing', progressMessage: 'Enqueued in pipeline...' } : f))

      // Establish SSE stream pointing directly to ms1
      const sseUrl = `http://localhost:4000/api/status/stream/${jobId}`
      const eventSource = new EventSource(sseUrl)

      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data)
        
        if (payload.status === 'processing') {
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, progressMessage: payload.message || 'Extracting fields...' } : f))
        } else if (payload.status === 'completed') {
          eventSource.close()
          const data = payload.data
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { 
            ...f, 
            status: 'completed', 
            progressMessage: 'Ready for review', 
            extraction: data 
          } : f))
        } else if (payload.status === 'failed') {
          eventSource.close()
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { 
            ...f, 
            status: 'failed', 
            progressMessage: payload.error || 'Failed analysis' 
          } : f))
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setUploadedFiles(prev => prev.map(f => f.id === fileId ? { 
          ...f, 
          status: 'failed', 
          progressMessage: 'Lost pipeline connection' 
        } : f))
      }

    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed upload initiation.'
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        status: 'failed', 
        progressMessage: msg 
      } : f))
    }
  }

  const handleUploadAll = () => {
    uploadedFiles.forEach(f => {
      if (f.status === 'idle') {
        handleUploadSingle(f.id)
      }
    })
  }

  const handleSkipToManual = (fileId) => {
    const item = uploadedFiles.find(f => f.id === fileId)
    if (!item) return

    const mockExtraction = {
      raw_extraction: {},
      confidence_scores: {},
      candidate_visits: []
    }
    
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? {
      ...f,
      status: 'completed',
      progressMessage: 'Manual editing',
      extraction: mockExtraction
    } : f))
  }

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
          patient_id: user.id,
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
        const payload = {
          patient_id: user.id,
          source_photo_id: activeItem.extraction.source_photo_id,
          visit_id: finalVisitId,
          brand_name: prescriptionFields.brand_name,
          dosage: prescriptionFields.dosage,
          frequency: prescriptionFields.frequency,
          duration_text: prescriptionFields.duration_text,
          brand_mapping_correction: activeItem.extraction.resolution?.status === 'generic_unresolved' ? {
            brand_name: prescriptionFields.brand_name,
            generic_name: activeItem.extraction.resolution.generic_name || 'Generic molecule'
          } : undefined
        }
        await api.post('/medicines', payload)
      } else {
        const payload = {
          patient_id: user.id,
          source_photo_id: activeItem.extraction.source_photo_id,
          visit_id: finalVisitId,
          disease_type: labFields.disease_type || undefined,
          values: [{
            test_type: labFields.test_type,
            panel_name: labFields.panel_name,
            value: parseFloat(labFields.value),
            unit: labFields.unit,
            confidence: activeItem.extraction.confidence_scores?.value || 1.0,
          }]
        }
        await api.post('/lab-reports/confirm', payload)
      }

      setSuccess('✔ Clinical record successfully confirmed and saved!')
      
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

  const handleRemoveFromQueue = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
    if (activeFileId === fileId) {
      const remaining = uploadedFiles.filter(f => f.id !== fileId)
      setActiveFileId(remaining.length > 0 ? remaining[0].id : null)
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
      <main className="flex-grow flex flex-col items-center py-16 px-6 md:px-16 w-full max-w-[1200px] mx-auto animate-fade-in text-left">
        
        {/* Header */}
        <header className="mb-12 max-w-2xl w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
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
              
              {/* Left Column: File Queue (span 4) */}
              <div className="lg:col-span-4 space-y-4 border-r border-slate-100 pr-0 lg:pr-6 text-left">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Upload Queue ({uploadedFiles.length})</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={triggerFileSelect}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">add</span> Add
                    </button>
                    <button
                      onClick={handleUploadAll}
                      disabled={uploadedFiles.every(f => f.status !== 'idle')}
                      className="text-xs bg-[#0f766e] hover:bg-[#0d645c] disabled:opacity-50 text-white px-2.5 py-1.5 rounded font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">rocket_launch</span> Extract All
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
                  {uploadedFiles.map((item) => {
                    const isActive = activeFileId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveFileId(item.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3 relative group ${
                          isActive 
                            ? 'bg-teal-50/20 border-[#0f766e] shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* File Thumbnail or PDF icon */}
                        <div className="w-12 h-12 rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.isPdf ? (
                            <span className="material-symbols-outlined text-rose-600 text-2xl">picture_as_pdf</span>
                          ) : item.preview ? (
                            <img src={item.preview} className="w-full h-full object-cover" alt="Preview" />
                          ) : (
                            <span className="material-symbols-outlined text-slate-400 text-2xl">image</span>
                          )}
                        </div>

                        {/* File Description */}
                        <div className="flex-grow min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate mb-1" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase">
                              {item.docType === 'prescription' ? 'Rx' : 'Lab'}
                            </span>
                            <span className={`text-[10px] font-semibold ${
                              item.status === 'completed' ? 'text-emerald-700' :
                              item.status === 'failed' ? 'text-red-600' :
                              item.status === 'processing' ? 'text-sky-600 animate-pulse' :
                              item.status === 'uploading' ? 'text-blue-600' : 'text-slate-400'
                            }`}>
                              {item.progressMessage}
                            </span>
                          </div>
                        </div>

                        {/* Checkmark or Delete */}
                        {item.saved ? (
                          <span className="material-symbols-outlined text-emerald-600 text-lg absolute top-2 right-2">check_circle</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromQueue(item.id);
                            }}
                            className="absolute top-2 right-2 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Review Form / Action Area (span 8) */}
              <div className="lg:col-span-8">
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
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFiles(prev => prev.map(f => f.id === activeItem.id ? { ...f, docType: 'prescription' } : f))
                                }}
                                className={`flex-1 text-center py-2 text-xs font-bold rounded transition-all cursor-pointer ${
                                  activeItem.docType === 'prescription' ? 'bg-[#0f766e] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Prescription
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFiles(prev => prev.map(f => f.id === activeItem.id ? { ...f, docType: 'lab_report' } : f))
                                }}
                                className={`flex-1 text-center py-2 text-xs font-bold rounded transition-all cursor-pointer ${
                                  activeItem.docType === 'lab_report' ? 'bg-[#0f766e] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Lab Report
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button
                              onClick={() => handleUploadSingle(activeItem.id)}
                              className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-6 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">rocket_launch</span> Extract Now
                            </button>
                            <button
                              onClick={() => handleSkipToManual(activeItem.id)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-semibold cursor-pointer"
                            >
                              Skip to Manual Entry
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 2. Uploading / processing states
                    if (activeItem.status === 'uploading' || activeItem.status === 'processing') {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 border border-slate-200 rounded-2xl bg-white min-h-[400px] shadow-sm text-center">
                          <div className="mb-6 relative">
                            <div className="w-20 h-24 border border-slate-200 rounded-lg bg-white relative overflow-hidden flex items-center justify-center shadow-sm">
                              <div className="absolute top-0 left-0 w-full h-1 bg-[#0f766e] animate-[scan_2s_ease-in-out_infinite]"></div>
                              <span className="material-symbols-outlined text-3xl text-slate-200">
                                {activeItem.docType === 'prescription' ? 'prescriptions' : 'biotech'}
                              </span>
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1">Analyzing Document</h3>
                          <p className="text-xs text-slate-500 mb-4">{activeItem.progressMessage}</p>
                          <div className="w-full max-w-xs bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto">
                            <div className="bg-[#0f766e] h-full w-[70%] animate-pulse"></div>
                          </div>
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
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-6 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">replay</span> Retry Upload
                            </button>
                            <button
                              onClick={() => handleSkipToManual(activeItem.id)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-semibold cursor-pointer"
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
                      return (
                        <div className="flex flex-col w-full text-left">
                          <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold text-slate-800">Review Extraction: {activeItem.name}</h2>
                            <span className="bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-xs px-3 py-1 rounded-md">
                              Review Required
                            </span>
                          </div>

                          {activeExtraction.needs_follow_up && (
                            <div className="mb-6 p-4 bg-sky-50 border-l-4 border-sky-500 text-sky-800 text-xs rounded-r-lg">
                              <strong className="block mb-1 font-bold">Extraction Validation Mismatch:</strong>
                              {activeExtraction.follow_up_question}
                            </div>
                          )}

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            
                            {/* Left: Document View Panel */}
                            <div className="flex flex-col border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
                              <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center text-xs text-slate-500 font-semibold">
                                <span>Preview Panel</span>
                                <span>{activeItem.isPdf ? 'PDF File' : 'Image File'}</span>
                              </div>
                              <div className="p-4 flex-grow flex items-center justify-center min-h-[350px] bg-slate-150">
                                {activeItem.isPdf ? (
                                  <div className="flex flex-col items-center justify-center text-center gap-3">
                                    <span className="material-symbols-outlined text-6xl text-rose-500">picture_as_pdf</span>
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={activeItem.name}>
                                      {activeItem.name}
                                    </span>
                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-semibold uppercase">
                                      PDF Document
                                    </span>
                                  </div>
                                ) : (
                                  <img className="object-contain max-h-[350px] w-full rounded border border-slate-200 shadow-sm" src={activeItem.preview} alt="Document preview" />
                                )}
                              </div>
                            </div>

                            {/* Right: Validation Forms */}
                            <form onSubmit={handleSaveActive} className="space-y-5">
                              
                              {activeItem.docType === 'prescription' ? (
                                <div className="space-y-4">
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <label className="text-xs font-bold text-slate-700">Brand Name</label>
                                      {getConfidenceBadge(activeExtraction.confidence_scores?.brand_name || 1.0)}
                                    </div>
                                    <input
                                      type="text"
                                      required
                                      value={prescriptionFields.brand_name}
                                      onChange={(e) => setPrescriptionFields({ ...prescriptionFields, brand_name: e.target.value })}
                                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-bold text-slate-700 mb-1">Dosage</label>
                                      <input
                                        type="text"
                                        required
                                        value={prescriptionFields.dosage}
                                        onChange={(e) => setPrescriptionFields({ ...prescriptionFields, dosage: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-700 mb-1">Frequency</label>
                                      <input
                                        type="text"
                                        required
                                        value={prescriptionFields.frequency}
                                        onChange={(e) => setPrescriptionFields({ ...prescriptionFields, frequency: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Duration</label>
                                    <input
                                      type="text"
                                      required
                                      value={prescriptionFields.duration_text}
                                      onChange={(e) => setPrescriptionFields({ ...prescriptionFields, duration_text: e.target.value })}
                                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-slate-700">Test Type</label>
                                        {getConfidenceBadge(activeExtraction.confidence_scores?.test_type || 1.0)}
                                      </div>
                                      <input
                                        type="text"
                                        required
                                        value={labFields.test_type}
                                        onChange={(e) => setLabFields({ ...labFields, test_type: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-700 mb-1">Panel Name</label>
                                      <input
                                        type="text"
                                        value={labFields.panel_name}
                                        onChange={(e) => setLabFields({ ...labFields, panel_name: e.target.value })}
                                        placeholder="e.g. Lipid Profile"
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-slate-700">Measured Value</label>
                                        {getConfidenceBadge(activeExtraction.confidence_scores?.value || 1.0)}
                                      </div>
                                      <input
                                        type="text"
                                        required
                                        value={labFields.value}
                                        onChange={(e) => setLabFields({ ...labFields, value: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                                      <input
                                        type="text"
                                        required
                                        value={labFields.unit}
                                        onChange={(e) => setLabFields({ ...labFields, unit: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
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
                                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Visit Proximity linking */}
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

                              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button 
                                  type="submit" 
                                  disabled={saving}
                                  className="bg-[#0f766e] hover:bg-[#0d645c] text-white font-semibold text-xs px-6 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
    </>
  )
}
