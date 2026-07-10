import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import MedicineList from './pages/MedicineList.jsx'
import Alerts from './pages/Alerts.jsx'
import CaregiverDashboard from './pages/CaregiverDashboard.jsx'
import AdminReview from './pages/AdminReview.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/medicines" element={<MedicineList />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/caregiver" element={<CaregiverDashboard />} />
      <Route path="/admin/review" element={<AdminReview />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
