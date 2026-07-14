import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Upload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [extraction, setExtraction] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  // Editable form fields for low-confidence corrections
  const [editFields, setEditFields] = useState({
    brand_name: '',
    generic_name: '',
    dosage: '',
    frequency: '',
    duration_text: '',
  })

  const handleFileSelect = (e) => {
    const selected = e.target.files[0]
    if (!selected) return
    if (selected.size > 8 * 1024 * 1024) {
      setError('File too large. Maximum size is 8MB.')
      return
    }
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setError('')
    setExtraction(null)
    setSaved(false)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('patient_id', user.id)

      const res = await api.post('/medicines/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data.data
      setExtraction(data)

      // Pre-populate edit fields from extraction
      setEditFields({
        brand_name: data.raw_extraction?.brand_name || '',
        generic_name: data.resolution?.generic_name || '',
        dosage: data.raw_extraction?.dosage || '',
        frequency: data.raw_extraction?.frequency || '',
        duration_text: data.raw_extraction?.duration_text || '',
      })
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Check if any field is below 85%
  const isLowConfidence = extraction && extraction.confidence_scores &&
    Object.values(extraction.confidence_scores).some(s => s < 0.85)

  const needsConfirmation = extraction && (isLowConfidence || extraction.needs_follow_up)

  const handleConfirmAndAdd = async () => {
    setSaving(true)
    setError('')
    try {
      const body = {
        patient_id: user.id,
        brand_name: editFields.brand_name,
        generic_name: editFields.generic_name || null,
        dosage: editFields.dosage,
        frequency: editFields.frequency,
        duration_text: editFields.duration_text || null,
        resolution_status: 'manually_resolved',
      }

      // If the user corrected the brand name, include brand_mapping_correction
      if (extraction.raw_extraction?.brand_name !== editFields.brand_name || editFields.generic_name) {
        body.brand_mapping_correction = {
          brand_name: editFields.brand_name,
          generic_name: editFields.generic_name,
        }
      }

      await api.post('/medicines', body)
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save medicine')
    } finally {
      setSaving(false)
    }
  }

  const handleAutoAdd = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post('/medicines', {
        patient_id: user.id,
        brand_name: extraction.raw_extraction.brand_name,
        generic_name: extraction.resolution?.generic_name || null,
        dosage: extraction.raw_extraction.dosage,
        frequency: extraction.raw_extraction.frequency,
        duration_text: extraction.raw_extraction.duration_text || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save medicine')
    } finally {
      setSaving(false)
    }
  }

  const confidenceColor = (score) => {
    if (score >= 0.85) return '#22c55e'
    if (score >= 0.70) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="page-container">
      <h1>📷 Upload Prescription</h1>
      <p className="subtitle">
        Photograph your prescription and we'll extract medicine details automatically
      </p>

      <div className="upload-area" id="upload-area" onClick={() => fileInputRef.current?.click()}>
        {preview ? (
          <img src={preview} alt="Prescription preview" className="upload-preview" />
        ) : (
          <div className="upload-placeholder">
            <span className="upload-icon">📸</span>
            <p>Click or tap to select a prescription photo</p>
            <p className="upload-hint">Supports JPG, PNG up to 8MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          hidden
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {file && !extraction && (
        <button
          id="btn-analyze"
          className="btn-primary"
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? 'Analyzing…' : 'Analyze Prescription'}
        </button>
      )}

      {saved && (
        <div className="success-banner" id="save-success">
          <h3>✅ Medicine saved successfully!</h3>
          <p>Your medicine has been added and checked for interactions.</p>
          <button className="btn-primary" onClick={() => navigate('/medicines')}>
            View Medicine List
          </button>
        </div>
      )}

      {extraction && !saved && (
        <div className="extraction-result" id="extraction-result">
          <h3>Extraction Results</h3>

          {/* Confidence scores */}
          <div className="confidence-panel">
            <h4>Confidence Scores</h4>
            <div className="confidence-grid">
              {Object.entries(extraction.confidence_scores || {}).map(([field, score]) => (
                <div key={field} className="confidence-item">
                  <span className="confidence-label">{field.replace(/_/g, ' ')}</span>
                  <span className="confidence-bar">
                    <span
                      className="confidence-fill"
                      style={{
                        width: `${Math.round(score * 100)}%`,
                        backgroundColor: confidenceColor(score),
                      }}
                    />
                  </span>
                  <span className="confidence-value" style={{ color: confidenceColor(score) }}>
                    {Math.round(score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-up question */}
          {extraction.follow_up_question && (
            <div className="followup-banner">
              <strong>🔍 Follow-up:</strong> {extraction.follow_up_question}
            </div>
          )}

          {needsConfirmation ? (
            <div className="confirm-panel" id="confirm-panel">
              <h4>⚠️ Please verify these details</h4>
              <p className="confirm-hint">
                Some fields had low confidence. Please review the original prescription and correct any errors below.
              </p>

              <div className="form-group">
                <label htmlFor="edit-brand">Brand Name</label>
                <input id="edit-brand" value={editFields.brand_name}
                  onChange={e => setEditFields({...editFields, brand_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label htmlFor="edit-generic">Generic Name</label>
                <input id="edit-generic" value={editFields.generic_name}
                  onChange={e => setEditFields({...editFields, generic_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label htmlFor="edit-dosage">Dosage</label>
                <input id="edit-dosage" value={editFields.dosage}
                  onChange={e => setEditFields({...editFields, dosage: e.target.value})} />
              </div>
              <div className="form-group">
                <label htmlFor="edit-frequency">Frequency</label>
                <input id="edit-frequency" value={editFields.frequency}
                  onChange={e => setEditFields({...editFields, frequency: e.target.value})} />
              </div>
              <div className="form-group">
                <label htmlFor="edit-duration">Duration</label>
                <input id="edit-duration" value={editFields.duration_text}
                  onChange={e => setEditFields({...editFields, duration_text: e.target.value})} />
              </div>

              <button id="btn-confirm" className="btn-primary" onClick={handleConfirmAndAdd} disabled={saving}>
                {saving ? 'Saving…' : 'Confirm and Add Medicine'}
              </button>
            </div>
          ) : (
            <div className="auto-add-panel">
              <h4>✅ High confidence extraction</h4>
              <div className="extracted-summary">
                <p><strong>Brand:</strong> {extraction.raw_extraction?.brand_name}</p>
                <p><strong>Generic:</strong> {extraction.resolution?.generic_name || '—'}</p>
                <p><strong>Dosage:</strong> {extraction.raw_extraction?.dosage}</p>
                <p><strong>Frequency:</strong> {extraction.raw_extraction?.frequency}</p>
                <p><strong>Duration:</strong> {extraction.raw_extraction?.duration_text || '—'}</p>
              </div>
              <button id="btn-auto-add" className="btn-primary" onClick={handleAutoAdd} disabled={saving}>
                {saving ? 'Saving…' : 'Add to My Medicines'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
