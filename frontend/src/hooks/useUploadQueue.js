import { useState, useRef, useEffect } from 'react'
import api from '../services/api'
import { useDocumentExtractionStream } from './useDocumentExtractionStream'

export function useUploadQueue(docType, patientId) {
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [activeFileId, setActiveFileId] = useState(null)
  const [duplicateFiles, setDuplicateFiles] = useState([])
  const fileInputRef = useRef(null)
  
  const { startStream } = useDocumentExtractionStream()

  // 1. Session Storage Hooks to preserve state across refreshes & tab switches
  useEffect(() => {
    const cachedQueue = sessionStorage.getItem('medguard_upload_queue');
    const cachedActiveId = sessionStorage.getItem('medguard_active_file_id');
    if (cachedQueue) {
      try {
        const parsed = JSON.parse(cachedQueue);
        setUploadedFiles(parsed);
        if (cachedActiveId) {
          setActiveFileId(cachedActiveId);
        }
      } catch (err) {
        console.error('Failed to parse cached upload queue:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      const serializable = uploadedFiles.map(f => ({
        id: f.id,
        name: f.name,
        status: f.status,
        progressMessage: f.progressMessage,
        jobId: f.jobId,
        extraction: f.extraction,
        docType: f.docType,
        isPdf: f.isPdf,
        saved: f.saved,
        needsClassificationConfirmation: f.needsClassificationConfirmation,
        classificationConfidence: f.classificationConfidence,
        base64: f.base64,
        contentHash: f.contentHash
      }));
      sessionStorage.setItem('medguard_upload_queue', JSON.stringify(serializable));
    } else {
      sessionStorage.removeItem('medguard_upload_queue');
    }
  }, [uploadedFiles]);

  useEffect(() => {
    if (activeFileId) {
      sessionStorage.setItem('medguard_active_file_id', activeFileId);
    } else {
      sessionStorage.removeItem('medguard_active_file_id');
    }
  }, [activeFileId]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length > 0) {
      const newItems = [];
      const duplicateNames = [];

      for (const file of selectedFiles) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        // Calculate file SHA-256 hash using crypto.subtle
        let contentHash = '';
        try {
          const arrayBuffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (hashErr) {
          console.error('Failed to calculate file hash:', hashErr);
          contentHash = 'error-' + Math.random().toString(36).substring(7);
        }

        // Compare against existing uploadedFiles queue
        const isDuplicate = uploadedFiles.some(f => f.contentHash === contentHash);
        if (isDuplicate) {
          duplicateNames.push(file.name);
          continue;
        }

        // Convert file content to Base64 to survive browser refresh
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });

        newItems.push({
          id: Math.random().toString(36).substring(7),
          file,
          name: file.name,
          preview: isPdf ? null : base64,
          isPdf,
          status: 'idle',
          progressMessage: 'Ready to extract',
          extraction: null,
          saved: false,
          docType: docType,
          base64: base64,
          contentHash
        });
      }

      if (duplicateNames.length > 0) {
        setDuplicateFiles(duplicateNames);
      }

      if (newItems.length > 0) {
        setUploadedFiles(prev => [...prev, ...newItems]);
        
        // Auto-activate the first newly added file if there isn't an active one
        if (!activeFileId) {
          setActiveFileId(newItems[0].id);
        }
      }
    }
    // Reset file input so same file can be selected again
    e.target.value = '';
  }

  const handleUploadSingle = async (fileId) => {
    const item = uploadedFiles.find(f => f.id === fileId)
    if (!item || (item.status !== 'idle' && item.status !== 'failed')) return

    // Mark as uploading
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'uploading', progressMessage: 'Uploading to server...' } : f))

    let fileObj = item.file;
    if (!fileObj && item.base64) {
      try {
        const response = await fetch(item.base64);
        const blob = await response.blob();
        fileObj = new File([blob], item.name, { type: item.isPdf ? 'application/pdf' : 'image/png' });
      } catch (err) {
        console.error('Failed to reconstruct file from base64:', err);
      }
    }

    const formData = new FormData()
    if (fileObj) {
      formData.append('photo', fileObj)
    }
    if (patientId) {
      formData.append('patient_id', patientId)
    }

    const endpoint = '/documents/upload'

    try {
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      const { jobId } = res.data.data
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, jobId, status: 'processing', progressMessage: 'Enqueued in pipeline...' } : f))

      startStream(jobId, fileId, setUploadedFiles);

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

  const handleRemoveFromQueue = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
    if (activeFileId === fileId) {
      const remaining = uploadedFiles.filter(f => f.id !== fileId)
      setActiveFileId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  return {
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
  }
}
