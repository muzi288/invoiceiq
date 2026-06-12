import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import InvoiceDetail from './pages/InvoiceDetail'
import Audit from './pages/Audit'
import Settings from './pages/Settings'
import Team from './pages/Team'
import Vendors from './pages/Vendors'
import VendorDetail from './pages/VendorDetail'
import Export from './pages/Export'

function OwnerRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (user?.role !== 'owner') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
      <Route path="/invoices/:id" element={<PrivateRoute><InvoiceDetail /></PrivateRoute>} />
      <Route path="/vendors" element={<PrivateRoute><Vendors /></PrivateRoute>} />
      <Route path="/vendors/:id" element={<PrivateRoute><VendorDetail /></PrivateRoute>} />
      <Route path="/export" element={<PrivateRoute><Export /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/audit" element={<PrivateRoute><OwnerRoute><Audit /></OwnerRoute></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><OwnerRoute><Team /></OwnerRoute></PrivateRoute>} />
    </Routes>
  )
}
