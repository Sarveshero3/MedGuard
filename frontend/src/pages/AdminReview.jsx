export default function AdminReview() {
  return (
    <div className="page-container">
      <h1>🔬 Admin Review Queue</h1>
      <p className="subtitle">Review low-confidence extractions and unresolved brands</p>

      <div className="empty-state">
        <span className="empty-icon">📋</span>
        <h3>Review queue empty</h3>
        <p>No pending extractions require clinical review</p>
      </div>
    </div>
  )
}
