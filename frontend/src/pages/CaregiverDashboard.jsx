export default function CaregiverDashboard() {
  return (
    <div className="page-container">
      <h1>👨‍👩‍👧 Caregiver Dashboard</h1>
      <p className="subtitle">Monitor your linked patient's medication safety</p>

      <div className="empty-state">
        <span className="empty-icon">🔗</span>
        <h3>No linked patients</h3>
        <p>Ask a patient to send you a caregiver invitation to get started</p>
      </div>
    </div>
  )
}
