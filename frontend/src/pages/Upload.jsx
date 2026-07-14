import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { MgNavbar } from '../components/MgNavbar'

export default function Upload() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])
  
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [extraction, setExtraction] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  // Editable form fields for verification
  const [editFields, setEditFields] = useState({
    brand_name: '',
    dosage: '',
    frequency: '',
    duration_text: '',
    visit_type: 'general',
    course_end_date: '',
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
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    
    const formData = new FormData()
    formData.append('prescription', file)
    if (user) {
      formData.append('patient_id', user.id)
    }

    try {
      const res = await api.post('/prescriptions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      const ext = res.data.data.extracted_data
      setExtraction(ext)
      setEditFields({
        brand_name: ext.brand_name || '',
        dosage: ext.dosage || '',
        frequency: ext.frequency || '',
        duration_text: ext.duration_text || '',
        visit_type: ext.visit_type || 'general',
        course_end_date: ext.course_end_date || '',
      })
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to analyze prescription')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        patient_id: user.id,
        prescription_id: extraction?.id || 'manual-upload',
        confirmed_data: {
          brand_name: editFields.brand_name,
          dosage: editFields.dosage,
          frequency: editFields.frequency,
          duration_text: editFields.duration_text,
          visit_type: editFields.visit_type,
          course_end_date: editFields.course_end_date,
        },
      }
      await api.post('/prescriptions/confirm', payload)
      setSaved(true)
      setTimeout(() => {
        navigate('/medicines')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save medication')
    } finally {
      setSaving(false)
    }
  }

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return 'bg-[#0f766e]'
    if (score >= 0.70) return 'bg-amber-500'
    return 'bg-[#ba1a1a]'
  }

  const getConfidenceText = (score) => {
    if (score >= 0.85) return 'High Confidence'
    if (score >= 0.70) return 'Moderate Confidence'
    return 'Low Confidence (Verify)'
  }

  return (
    <>
      {/* Main Workspace Area */}
      <main className="flex-grow flex flex-col items-center py-16 px-6 md:px-16 w-full max-w-[1200px] mx-auto animate-fade-in">
        
        {/* Header */}
        <header className="text-center mb-12 max-w-2xl">
          <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Upload Prescription</h1>
          <p className="text-sm text-slate-500">
            Securely digitize your medical documents for clinical review and accurate medication tracking.
          </p>
        </header>

        {/* Workspace Card */}
        <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-6 md:p-12 relative overflow-hidden shadow-sm">
          
          {error && (
            <div className="error-banner mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
              {error}
            </div>
          )}

          {saved && (
            <div className="success-banner mb-8 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-left">
              ✔ Medication verified and added successfully! Redirecting to list...
            </div>
          )}

          {/* STEP 1: Upload Dropzone (Default View) */}
          {!uploading && !extraction && (
            <div className="flex flex-col items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
              />
              <div 
                onClick={triggerFileSelect}
                className="w-full max-w-3xl border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[400px] hover:border-slate-400 hover:bg-slate-50/50 transition-all duration-200"
              >
                {preview ? (
                  <div className="relative max-h-[300px] overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    <img src={preview} alt="Prescription preview" className="max-h-[300px] w-auto object-contain" />
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-6xl text-slate-400 mb-6">document_scanner</span>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Drag &amp; Drop Prescription</h3>
                    <p className="text-sm text-slate-500 mb-8">or select an option below to add your document</p>
                  </>
                )}

                <div className="flex flex-col sm:flex-row gap-4 mt-6" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={triggerFileSelect}
                    className="bg-[#0f766e] hover:bg-accent-hover text-white font-semibold text-sm px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_a_photo</span>
                    Browse Files
                  </button>
                  {preview && (
                    <button 
                      onClick={handleUpload}
                      className="bg-transparent border border-[#0f766e] text-[#0f766e] hover:bg-slate-50 font-semibold text-sm px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      Analyze Regimen
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-8">Supported formats: JPG, PNG, PDF. Max size: 10MB.</p>
              </div>
            </div>
          )}

          {/* STEP 2: Processing State */}
          {uploading && (
            <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-3xl mx-auto">
              <div className="mb-8 relative">
                <div className="w-32 h-40 border border-slate-200 rounded-lg bg-white relative overflow-hidden flex items-center justify-center shadow-sm">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#0f766e] animate-[scan_2s_ease-in-out_infinite]"></div>
                  <span className="material-symbols-outlined text-5xl text-slate-200">prescriptions</span>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Analyzing Clinical Data</h3>
              <p className="text-sm text-slate-500 mb-12">Extracting medication details, dosages, and physician instructions.</p>
              
              <div className="w-full max-w-md space-y-6 text-left">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-800">Medication Identification</span>
                    <span className="text-[#0f766e]">98% Confidence</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#0f766e] h-full w-[98%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-800">Dosage Extraction</span>
                    <span className="text-[#0f766e]">95% Confidence</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#0f766e] h-full w-[95%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-800">Physician Verification</span>
                    <span className="text-amber-500">Analyzing...</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full w-[60%] animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review / Verification Form */}
          {!uploading && extraction && (
            <div className="flex flex-col w-full text-left">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-sans font-bold text-slate-900">Clinical Review</h2>
                <span className="bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-xs px-3 py-1 rounded-md">
                  Needs Verification
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                
                {/* Left: Source Document View */}
                <div className="flex flex-col border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
                  <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Source Document</span>
                    <div className="flex gap-2">
                      <button className="text-slate-400 hover:text-slate-600 p-1">
                        <span className="material-symbols-outlined text-lg">zoom_in</span>
                      </button>
                      <button className="text-slate-400 hover:text-slate-600 p-1">
                        <span className="material-symbols-outlined text-lg">zoom_out</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex-grow flex items-center justify-center min-h-[400px] relative bg-slate-200">
                    <img 
                      className="object-contain max-h-[400px] w-full rounded border border-slate-300 shadow-sm" 
                      src={preview || "https://lh3.googleusercontent.com/aida-public/AB6AXuANgc4O6EblNBqOBGRhpHkz24TRl1JmZ4MvJUSYFxuBKQyJpI8kvXdWOBBzxuVzhT4rIT9lCCKtCbmXMEs-yMOZ4qIL4mLWWuPsAfUFlLJ6kZy5T7QujuLbQqDX11bwCAZEDkrol6xqAJLTelN4wCKypAqAs70wTx2joHcpqjgXy4Cu6YFR1bV6oMMPfCpH3x77WolN98kd_bRGpZFJe__3gO17nCAT5qCEDEwDVA4AbFVuZMZp6Xl_"} 
                      alt="Prescription document"
                    />
                    <div className="absolute top-[35%] left-[15%] w-[70%] h-[12%] border-2 border-[#0f766e] bg-[#0f766e]/10 rounded animate-pulse"></div>
                  </div>
                </div>

                {/* Right: Verification Form */}
                <form onSubmit={handleSave} className="flex flex-col space-y-6 justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-6">
                      Please review the extracted data below. Correct any fields that do not match the original document.
                    </p>

                    <div className="space-y-4">
                      
                      {/* Brand Name Input */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="block text-sm font-semibold text-slate-800">Medication Name</label>
                          <span className="text-xs text-slate-400">
                            {getConfidenceText(extraction.confidence?.brand_name || 1.0)}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={editFields.brand_name}
                            onChange={(e) => setEditFields({ ...editFields, brand_name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none pr-10"
                          />
                          <span className="absolute right-3 top-3.5 material-symbols-outlined text-[#0f766e] text-lg">
                            check_circle
                          </span>
                        </div>
                      </div>

                      {/* Dosage Input */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="block text-sm font-semibold text-slate-800">Dosage</label>
                          <span className="text-xs text-slate-400">
                            {getConfidenceText(extraction.confidence?.dosage || 1.0)}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={editFields.dosage}
                            onChange={(e) => setEditFields({ ...editFields, dosage: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none pr-10"
                          />
                          <span className="absolute right-3 top-3.5 material-symbols-outlined text-[#0f766e] text-lg">
                            check_circle
                          </span>
                        </div>
                      </div>

                      {/* Frequency (Needs Attention if Low Confidence) */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="block text-sm font-semibold text-slate-800">Frequency</label>
                          <span className="text-xs text-amber-500 font-medium">
                            {getConfidenceText(extraction.confidence?.frequency || 0.5)}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={editFields.frequency}
                            onChange={(e) => setEditFields({ ...editFields, frequency: e.target.value })}
                            className={`w-full border rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none pr-10 ${
                              (extraction.confidence?.frequency || 0.5) < 0.7 
                                ? 'bg-red-50/20 border-amber-500' 
                                : 'bg-white border-slate-200'
                            }`}
                          />
                          <span className={`absolute right-3 top-3.5 material-symbols-outlined text-lg ${
                            (extraction.confidence?.frequency || 0.5) < 0.7 ? 'text-amber-500' : 'text-[#0f766e]'
                          }`}>
                            {(extraction.confidence?.frequency || 0.5) < 0.7 ? 'error' : 'check_circle'}
                          </span>
                        </div>
                        {(extraction.confidence?.frequency || 0.5) < 0.7 && (
                          <p className="text-xs text-amber-500 mt-1">Low confidence extraction. Please verify.</p>
                        )}
                      </div>

                      {/* Duration Text */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-2">Duration</label>
                        <input
                          type="text"
                          required
                          value={editFields.duration_text}
                          onChange={(e) => setEditFields({ ...editFields, duration_text: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                        />
                      </div>

                      {/* Doctor Appointment Specialty */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-2">Visit Specialty</label>
                        <select
                          value={editFields.visit_type}
                          onChange={(e) => setEditFields({ ...editFields, visit_type: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                        >
                          <option value="general">General Medicine</option>
                          <option value="cardiology">Cardiology</option>
                          <option value="neurology">Neurology</option>
                          <option value="orthopedics">Orthopedics</option>
                          <option value="pediatrics">Pediatrics</option>
                        </select>
                      </div>

                      {/* Course End Date */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-2">Course End Date</label>
                        <input
                          type="date"
                          value={editFields.course_end_date}
                          onChange={(e) => setEditFields({ ...editFields, course_end_date: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors outline-none"
                        />
                      </div>

                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end gap-4">
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
                      {saving ? 'Saving...' : 'Verify & Add Medication'}
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
            <Link to="/privacy" className="hover:text-[#0F766E] transition-colors">Privacy Policy</Link>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Clinical Guidelines</a>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Contact Support</a>
          </div>
          <div className="text-xs text-slate-400 mt-4 md:mt-0">
            © 2026 MedGuard AI. Clinical Excellence in Medication Safety.
          </div>
        </div>
      </footer>
    </>
  )
}
