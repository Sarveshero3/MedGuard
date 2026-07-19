import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import MedicineList from './pages/MedicineList.jsx'
import LabReports from './pages/LabReports.jsx'
import Alerts from './pages/Alerts.jsx'
import Calendar from './pages/Calendar.jsx'
import PrivacySettings from './pages/PrivacySettings.jsx'
import NotFound from './pages/NotFound.jsx'
import Home from './pages/Home.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import WriteBrief from './pages/WriteBrief.jsx'

// Static clinical content pages (Step 12)
import Terms from './pages/Terms.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import ClinicalGuidelines from './pages/ClinicalGuidelines.jsx'
import Support from './pages/Support.jsx'

import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      
      {/* Authenticated Clinical Workspace */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/medicines" element={<MedicineList />} />
          <Route path="/lab-reports" element={<LabReports />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/privacy" element={<PrivacySettings />} />
          <Route path="/brief/new" element={<WriteBrief />} />
          <Route path="/brief/:id" element={<WriteBrief />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/clinical-guidelines" element={<ClinicalGuidelines />} />
          <Route path="/support" element={<Support />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
