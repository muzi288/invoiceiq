import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import InvoiceDetail from './pages/InvoiceDetail'
import Audit from './pages/Audit'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <PrivateRoute><Dashboard /></PrivateRoute>
      } />
      <Route path="/upload" element={
        <PrivateRoute><Upload /></PrivateRoute>
      } />
      <Route path="/invoices/:id" element={
        <PrivateRoute><InvoiceDetail /></PrivateRoute>
      } />
      <Route path="/audit" element={
        <PrivateRoute><Audit /></PrivateRoute>
      } />
    </Routes>
  )
}
