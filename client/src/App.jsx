import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import { useState } from 'react';
import WardSelect from './components/WardSelect';
import IssueForm from './components/IssueForm';

// Placeholder pages — we'll build these next
const Landing = () => <div className="p-8 text-2xl">Landing Page</div>;
const Login = () => <div className="p-8 text-2xl">Login Page</div>;
const Register = () => {
  const [ward, setWard] = useState('');
  
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Create an Account</h1>
        
        {/* Your WardSelect Component */}
        <WardSelect value={ward} onChange={setWard} />
        
        {ward && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center text-green-700">
            ✅ Selected Ward ID: {ward}
          </div>
        )}
      </div>
    </div>
  );
};
const Dashboard = () => <div className="p-8 text-2xl">Citizen Dashboard</div>;
const OfficerDashboard = () => <div className="p-8 text-2xl">Officer Dashboard</div>;
const AdminDashboard = () => <div className="p-8 text-2xl">Admin Dashboard</div>;
const IssueDetail = () => <div className="p-8 text-2xl">Issue Detail Page</div>;
const NotFound = () => <div className="p-8 text-2xl">404 — Page Not Found</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/issue/:id" element={<IssueDetail />} />
        <Route path="/report" element={<IssueForm />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/officer"
          element={
            <ProtectedRoute role="officer">
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;