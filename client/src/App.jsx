import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';

// Placeholder pages — we'll build these next
const Landing = () => <div className="p-8 text-2xl">Landing Page</div>;
const Login = () => <div className="p-8 text-2xl">Login Page</div>;
const Register = () => <div className="p-8 text-2xl">Register Page</div>;
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