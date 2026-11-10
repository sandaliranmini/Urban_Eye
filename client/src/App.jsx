import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  AuthProvider,
  ProtectedRoute,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  CitizenDashboard,
  OfficerDashboard,
  AdminDashboard,
} from './AuthApp';

// Placeholder pages (to be built later)
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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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