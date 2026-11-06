import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  AuthProvider,
  ProtectedRoute,
  LoginPage,
  RegisterPage,
  CitizenDashboard,
  OfficerDashboard,
  AdminDashboard,
} from './Authapp';

// Placeholder pages (to be built later)
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
const NotFound = () => <div className="p-8 text-2xl">404: Page Not Found</div>;

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/issue/:id" element={<IssueDetail />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['citizen']}>
                <CitizenDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer"
            element={
              <ProtectedRoute roles={['field_officer', 'supervisor']}>
                <OfficerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;