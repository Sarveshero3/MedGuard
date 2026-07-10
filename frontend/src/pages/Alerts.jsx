export default function Alerts() {
  return (
    <div className="page-container">
      <h1>⚠️ Interaction Alerts</h1>
      <p className="subtitle">Drug interaction warnings and safety flags</p>

      <div className="empty-state">
        <span className="empty-icon">✅</span>
        <h3>No alerts</h3>
        <p>No drug interactions detected — your medicines look safe</p>
      </div>
    </div>
  )
}
