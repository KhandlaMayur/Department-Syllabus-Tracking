import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/common/Loading';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loading fullScreen label="Checking your session..." />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const isPermitted = !allowedRoles || allowedRoles.includes(role) || (allowedRoles.includes('cc') && user?.isCC);

  if (!isPermitted) {
    return (
      <Navigate
        to="/access-denied"
        state={{ requiredRoles: allowedRoles, currentRole: role }}
        replace
      />
    );
  }

  return children;
}