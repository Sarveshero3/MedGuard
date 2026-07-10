export default function MedicineList() {
  return (
    <div className="page-container">
      <h1>💊 My Medicines</h1>
      <p className="subtitle">Active and historical prescriptions</p>

      <div className="empty-state">
        <span className="empty-icon">💊</span>
        <h3>No medicines yet</h3>
        <p>Upload your first prescription to get started</p>
      </div>
    </div>
  )
}
