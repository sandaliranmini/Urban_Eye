import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, role }) {
  const location = useLocation();
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('role');

  // Not logged in → redirect to login, remember where they wanted to go
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role mismatch → redirect to their own dashboard
  if (role && userRole !== role) {
    const fallback =
      userRole === 'officer'
        ? '/officer'
        : userRole === 'admin'
          ? '/admin'
          : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
}