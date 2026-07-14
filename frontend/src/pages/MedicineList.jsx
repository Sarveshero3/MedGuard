import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function MedicineList() {
  const { user } = useAuth()
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'active' | 'discontinued'

  useEffect(() => {
    if (!user) return
    fetchMedicines()
  }, [user])

  const fetchMedicines = async () => {
    setLoading(true)
    try {
      const res = await api.get('/medicines', { params: { patient_id: user.id } })
      setMedicines(res.data.data)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load medicines')
    }
    setLoading(false)
  }

  const handleDiscontinue = async (medId) => {
    try {
      await api.put(`/medicines/${medId}`, { status: 'discontinued' })
      setMedicines(prev => prev.map(m => m.id === medId ? { ...m, status: 'discontinued' } : m))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update medicine')
    }
  }

  const handleReactivate = async (medId) => {
    try {
      await api.put(`/medicines/${medId}`, { status: 'active' })
      setMedicines(prev => prev.map(m => m.id === medId ? { ...m, status: 'active' } : m))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update medicine')
    }
  }

  const filtered = medicines.filter(m => {
    if (filter === 'active') return m.status === 'active'
    if (filter === 'discontinued') return m.status === 'discontinued'
    return true
  })

  const statusBadge = (status) => {
    if (status === 'active') return <span className="badge badge-active">Active</span>
    return <span className="badge badge-discontinued">Discontinued</span>
  }

  const resolutionBadge = (rs) => {
    if (rs === 'resolved') return <span className="badge badge-resolved">Resolved</span>
    if (rs === 'manually_resolved') return <span className="badge badge-manual">Manually Resolved</span>
    return <span className="badge badge-unresolved">Unresolved</span>
  }

  return (
    <div className="page-container">
      <h1>💊 My Medicines</h1>
      <p className="subtitle">Active and historical prescriptions</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="filter-tabs" id="medicine-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({medicines.length})</button>
        <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active ({medicines.filter(m => m.status === 'active').length})</button>
        <button className={filter === 'discontinued' ? 'active' : ''} onClick={() => setFilter('discontinued')}>Discontinued ({medicines.filter(m => m.status === 'discontinued').length})</button>
      </div>

      {loading ? (
        <p className="loading-text">Loading medicines…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💊</span>
          <h3>No medicines yet</h3>
          <p>Upload your first prescription to get started</p>
        </div>
      ) : (
        <div className="medicine-table-wrapper">
          <table className="medicine-table" id="medicine-table">
            <thead>
              <tr>
                <th>Brand Name</th>
                <th>Generic Name</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Status</th>
                <th>Resolution</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(med => (
                <tr key={med.id}>
                  <td>{med.brand_name}</td>
                  <td>{med.generic_name || '—'}</td>
                  <td>{med.dosage}</td>
                  <td>{med.frequency}</td>
                  <td>{statusBadge(med.status)}</td>
                  <td>{resolutionBadge(med.resolution_status)}</td>
                  <td>{new Date(med.added_at).toLocaleDateString()}</td>
                  <td>
                    {med.status === 'active' ? (
                      <button className="btn-sm btn-warn" onClick={() => handleDiscontinue(med.id)}>
                        Discontinue
                      </button>
                    ) : (
                      <button className="btn-sm btn-success" onClick={() => handleReactivate(med.id)}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
