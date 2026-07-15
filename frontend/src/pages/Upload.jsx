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
  
  // Document type switcher: 'prescription' or 'lab_report'
  const [docType, setDocType] = useState('prescription')
  
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [extraction, setExtraction] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  // Visit linking options
  const [linkVisitOption, setLinkVisitOption] = useState('none') // 'none', 'existing', 'new'
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [newVisitData, setNewVisitData] = useState({
    doctor_name: '',
    specialty: '',
    disease_type: '',
    scheduled_date: '',
  })

  // Editable prescription fields
  const [prescriptionFields, setPrescriptionFields] = useState({
    brand_name: '',
    dosage: '',
    frequency: '',
    duration_text: '',
    course_end_date: '',
  })

  // Editable lab report fields
  const [labFields, setLabFields] = useState({
    test_type: '',
    panel_name: '',
    value: '',
    unit: '',
    disease_type: '',
  })

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setError('')
      setExtraction(null)
      setSaved(false)
      setLinkVisitOption('none')
      setSelectedVisitId('')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    
    const formData = new FormData()
    formData.append('photo', file)
    if (user) {
      formData.append('patient_id', user.id)
    }

    const endpoint = docType === 'prescription' ? '/medicines/upload' : '/lab-reports/upload'

    try {
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      const { jobId } = res.data.data

      // Establish SSE stream
      const sseUrl = `http://localhost:4000/api/status/stream/${jobId}`
      const eventSource = new EventSource(sseUrl)

      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data)
        
        if (payload.status === 'completed') {
          eventSource.close()
          const data = payload.data
          setExtraction(data)

          // Initialize form fields based on type
          if (docType === 'prescription') {
            const raw = data.raw_extraction
            setPrescriptionFields({
              brand_name: raw.brand_name || '',
              dosage: raw.dosage || '',
              frequency: raw.frequency || '',
              duration_text: raw.duration_text || '',
              course_end_date: '',
            })
          } else {
            const raw = data.raw_extraction
            setLabFields({
              test_type: raw.test_type || '',
              panel_name: raw.panel_name || '',
              value: raw.value || '',
              unit: raw.unit || '',
              disease_type: '',
            })
          }

          // Proximity linking setup
          if (data.proposed_visit_id) {
            setLinkVisitOption('existing')
            setSelectedVisitId(data.proposed_visit_id)
          } else if (data.candidate_visits && data.candidate_visits.length > 0) {
            setLinkVisitOption('existing')
            setSelectedVisitId(data.candidate_visits[0].id)
          } else {
            setLinkVisitOption('none')
          }
          setUploading(false)
        } else if (payload.status === 'failed') {
          eventSource.close()
          setError(payload.error || 'Analysis failed.')
          setUploading(false)
        }
      }

      eventSource.onerror = (err) => {
        eventSource.close()
        setError('Lost connection to analysis pipeline.')
        setUploading(false)
      }

    } catch (err) {
      setError(err.response?.data?.error?.message || `Failed to analyze ${docType}`)
      setUploading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
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
          disease_type: docType === 'lab_report' ? labFields.disease_type : newVisitData.disease_type,
        })
        finalVisitId = visitRes.data.data.id
      } else if (linkVisitOption === 'existing') {
        finalVisitId = selectedVisitId
      }

      // 2. Submit confirmation payload
      if (docType === 'prescription') {
        const payload = {
          patient_id: user.id,
          source_photo_id: extraction?.source_photo_id,
          visit_id: finalVisitId,
          brand_name: prescriptionFields.brand_name,
          dosage: prescriptionFields.dosage,
          frequency: prescriptionFields.frequency,
          duration_text: prescriptionFields.duration_text,
          // If the brand resolved is different, user could confirm correction
          brand_mapping_correction: extraction?.resolution?.status === 'generic_unresolved' ? {
            brand_name: prescriptionFields.brand_name,
            generic_name: extraction?.resolution?.generic_name || 'Generic molecule'
          } : undefined
        }
        await api.post('/medicines', payload)
        setSaved(true)
        setTimeout(() => navigate('/medicines'), 1500)
      } else {
        const payload = {
          patient_id: user.id,
          source_photo_id: extraction?.source_photo_id,
          visit_id: finalVisitId,
          disease_type: labFields.disease_type || undefined,
          values: [{
            test_type: labFields.test_type,
            panel_name: labFields.panel_name,
            value: parseFloat(labFields.value),
            unit: labFields.unit,
            confidence: extraction?.confidence_scores?.value || 1.0,
          }]
        }
        await api.post('/lab-reports/confirm', payload)
        setSaved(true)
        setTimeout(() => navigate('/dashboard'), 1500)
      }

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
      <main className="flex-grow flex flex-col items-center py-16 px-6 md:px-16 w-full max-w-[1200px] mx-auto animate-fade-in text-left">
        
        {/* Header */}
        <header className="mb-12 max-w-2xl w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Clinical Upload Center</h1>
            <p className="text-sm text-slate-500">
              Digitize clinical prescriptions and lab analysis reports for safety checks and trend monitoring.
            </p>
          </div>

          {/* Doc Type Selector */}
          {!extraction && !uploading && (
            <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200 w-full md:w-auto">
              <button
                onClick={() => setDocType('prescription')}
                className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer flex-grow md:flex-grow-0 ${
                  docType === 'prescription' ? 'bg-[#0f766e] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Prescription
              </button>
              <button
                onClick={() => setDocType('lab_report')}
                className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer flex-grow md:flex-grow-0 ${
                  docType === 'lab_report' ? 'bg-[#0f766e] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lab Report
              </button>
            </div>
          )}
        </header>

        {/* Workspace Card */}
        <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-6 md:p-12 shadow-sm">
          
          {error && (
            <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {saved && (
            <div className="mb-8 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              ✔ Document confirmed and recorded! Redirecting...
            </div>
          )}

          {/* STEP 1: Upload Dropzone */}
          {!uploading && !extraction && (
            <div className="flex flex-col items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={triggerFileSelect}
                className="w-full max-w-3xl border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[400px] hover:border-slate-400 hover:bg-slate-50/50 transition-all duration-200"
              >
                {preview ? (
                  <div className="relative max-h-[300px] overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    <img src={preview} alt="Upload preview" className="max-h-[300px] w-auto object-contain" />
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-6xl text-slate-400 mb-6">
                      {docType === 'prescription' ? 'prescriptions' : 'biotech'}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      Upload {docType === 'prescription' ? 'Prescription' : 'Clinical Lab Report'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-8">Drag &amp; drop your image file here or click to browse</p>
                  </>
                )}

                <div className="flex gap-4 mt-6" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={triggerFileSelect}
                    className="bg-[#0f766e] hover:bg-accent-hover text-white font-semibold text-sm px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_a_photo</span>
                    Select Photo
                  </button>
                  {preview && (
                    <button 
                      onClick={handleUpload}
                      className="bg-transparent border border-[#0f766e] text-[#0f766e] hover:bg-slate-50 font-semibold text-sm px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">rocket_launch</span>
                      Extract Document
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-8">Accepts JPG, JPEG, and PNG. Max file size: 8MB.</p>
                <button 
                  type="button"
                  onClick={() => {
                    setExtraction({
                      raw_extraction: {},
                      confidence_scores: {},
                      candidate_visits: []
                    });
                    setPrescriptionFields({
                      brand_name: '',
                      dosage: '',
                      frequency: '',
                      duration_text: '',
                      course_end_date: '',
                    });
                    setLabFields({
                      test_type: '',
                      panel_name: '',
                      value: '',
                      unit: '',
                      disease_type: '',
                    });
                  }}
                  className="text-xs font-semibold text-[#0f766e] hover:underline mt-4 cursor-pointer"
                >
                  Or skip and enter details manually
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Extraction Loader */}
          {uploading && (
            <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-3xl mx-auto">
              <div className="mb-8 relative">
                <div className="w-32 h-40 border border-slate-200 rounded-lg bg-white relative overflow-hidden flex items-center justify-center shadow-sm">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#0f766e] animate-[scan_2s_ease-in-out_infinite]"></div>
                  <span className="material-symbols-outlined text-5xl text-slate-200">
                    {docType === 'prescription' ? 'prescriptions' : 'biotech'}
                  </span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Analyzing Clinical Record</h3>
              <p className="text-sm text-slate-500 mb-6">Running VLM extraction and structure mapping...</p>
              <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-[#0f766e] h-full w-[70%] animate-pulse"></div>
              </div>
            </div>
          )}

          {/* STEP 3: Verification & Linking Form */}
          {!uploading && extraction && (
            <div className="flex flex-col w-full">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-sans font-bold text-slate-900">Confirm Clinical Extraction</h2>
                <span className="bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-xs px-3 py-1 rounded-md">
                  Action Required
                </span>
              </div>

              {extraction.needs_follow_up && (
                <div className="mb-8 p-4 bg-sky-50 border-l-4 border-sky-500 text-sky-800 text-sm rounded-r-lg">
                  <strong className="block mb-1 font-bold">Extraction Query:</strong>
                  {extraction.follow_up_question}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                
                {/* Left: Preview */}
                <div className="flex flex-col border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
                  <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center text-xs text-slate-500 font-semibold">
                    <span>Document View</span>
                    <span>JPEG Document</span>
                  </div>
                  <div className="p-4 flex-grow flex items-center justify-center min-h-[400px] bg-slate-200">
                    <img className="object-contain max-h-[400px] w-full rounded border border-slate-300 shadow-sm" src={preview} alt="Clinical Document" />
                  </div>
                </div>

                {/* Right: Validation & Linking */}
                <form onSubmit={handleSave} className="space-y-6">
                  
                  {docType === 'prescription' ? (
                    // Prescription verification
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-sm font-semibold text-slate-800">Brand Name</label>
                          {getConfidenceBadge(extraction.confidence_scores?.brand_name || 1.0)}
                        </div>
                        <input
                          type="text"
                          required
                          value={prescriptionFields.brand_name}
                          onChange={(e) => setPrescriptionFields({ ...prescriptionFields, brand_name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Dosage</label>
                          <input
                            type="text"
                            required
                            value={prescriptionFields.dosage}
                            onChange={(e) => setPrescriptionFields({ ...prescriptionFields, dosage: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Frequency</label>
                          <input
                            type="text"
                            required
                            value={prescriptionFields.frequency}
                            onChange={(e) => setPrescriptionFields({ ...prescriptionFields, frequency: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1.5">Duration</label>
                        <input
                          type="text"
                          required
                          value={prescriptionFields.duration_text}
                          onChange={(e) => setPrescriptionFields({ ...prescriptionFields, duration_text: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    // Lab Report Verification
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-sm font-semibold text-slate-800">Test Type</label>
                            {getConfidenceBadge(extraction.confidence_scores?.test_type || 1.0)}
                          </div>
                          <input
                            type="text"
                            required
                            value={labFields.test_type}
                            onChange={(e) => setLabFields({ ...labFields, test_type: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Panel Name</label>
                          <input
                            type="text"
                            value={labFields.panel_name}
                            onChange={(e) => setLabFields({ ...labFields, panel_name: e.target.value })}
                            placeholder="e.g. Lipid Profile"
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-sm font-semibold text-slate-800">Measured Value</label>
                            {getConfidenceBadge(extraction.confidence_scores?.value || 1.0)}
                          </div>
                          <input
                            type="text"
                            required
                            value={labFields.value}
                            onChange={(e) => setLabFields({ ...labFields, value: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Unit</label>
                          <input
                            type="text"
                            required
                            value={labFields.unit}
                            onChange={(e) => setLabFields({ ...labFields, unit: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1.5">Disease / Clinical Indication</label>
                        <input
                          type="text"
                          value={labFields.disease_type}
                          onChange={(e) => setLabFields({ ...labFields, disease_type: e.target.value })}
                          placeholder="e.g. Diabetes, Thyroid"
                          className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Visit Proximity Linking Widget (Components 3 & 4) */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-lg">calendar_today</span>
                      Link to Doctor Visit
                    </h4>

                    {extraction.proposed_visit_id && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">verified</span>
                        <span>Auto-matched to proximity visit (confidence: 95%).</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 text-xs font-semibold text-slate-600">
                      <label className="flex items-center gap-2 cursor-pointer">
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
                      <label className="flex items-center gap-2 cursor-pointer">
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
                      <label className="flex items-center gap-2 cursor-pointer">
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
                      <div className="relative">
                        <select
                          value={selectedVisitId}
                          onChange={(e) => setSelectedVisitId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] appearance-none"
                        >
                          {extraction.candidate_visits && extraction.candidate_visits.length > 0 ? (
                            extraction.candidate_visits.map(v => (
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
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-left">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Appointment Date &amp; Time</label>
                          <input
                            type="datetime-local"
                            required
                            value={newVisitData.scheduled_date}
                            onChange={(e) => setNewVisitData({ ...newVisitData, scheduled_date: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0f766e]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor Name</label>
                          <input
                            type="text"
                            placeholder="Dr. Kumar"
                            value={newVisitData.doctor_name}
                            onChange={(e) => setNewVisitData({ ...newVisitData, doctor_name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0f766e]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Specialty</label>
                          <input
                            type="text"
                            placeholder="e.g. Cardiology"
                            value={newVisitData.specialty}
                            onChange={(e) => setNewVisitData({ ...newVisitData, specialty: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0f766e]"
                          />
                        </div>
                      </div>
                    )}

                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
                    <button 
                      type="button" 
                      onClick={() => {
                        setExtraction(null)
                        setFile(null)
                        setPreview(null)
                      }}
                      className="bg-transparent text-slate-500 hover:text-slate-900 font-semibold text-sm px-6 py-3 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="bg-[#0f766e] hover:bg-accent-hover text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">verified</span>
                      {saving ? 'Verifying...' : 'Save & Link Records'}
                    </button>
                  </div>
                </form>

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
