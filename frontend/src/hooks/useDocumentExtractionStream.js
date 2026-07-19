export function useDocumentExtractionStream() {
  const startStream = (jobId, fileId, setUploadedFiles) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
    const sseUrl = apiBase.startsWith('http')
      ? `${apiBase}/status/stream/${jobId}`
      : `${window.location.origin}${apiBase}/status/stream/${jobId}`
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
          extraction: data,
          docType: data.docType,
          needsClassificationConfirmation: data.needs_classification_confirmation,
          classificationConfidence: data.classification_confidence
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

    return eventSource;
  };

  return { startStream };
}
