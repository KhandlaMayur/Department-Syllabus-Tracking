import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/common/Loading';

const ROLE_HOME = {
  student: '/student',
  faculty: '/faculty',
  cc: '/cc',
  hod: '/hod',
};

/** Mounted at "/" — sends the signed-in user straight to their dashboard. */
export default function RoleHomeRedirect() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) return <Loading fullScreen label="Loading your dashboard..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
}
