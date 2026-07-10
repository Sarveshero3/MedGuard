import { useState, useRef } from 'react'
import api from '../services/api'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

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
    setResult(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const res = await api.post('/medicines/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data.data)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page-container">
      <h1>📷 Upload Prescription</h1>
      <p className="subtitle">
        Photograph your prescription and we'll extract medicine details automatically
      </p>

      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
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

      {file && !result && (
        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? 'Analyzing...' : 'Analyze Prescription'}
        </button>
      )}

      {result && (
        <div className="extraction-result">
          <h3>✅ Extraction Complete</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
