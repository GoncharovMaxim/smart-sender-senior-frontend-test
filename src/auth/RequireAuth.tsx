import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from './session';

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'unknown') return <p className="status">Перевірка сесії…</p>;
  if (session.status === 'anonymous') {
    // Keep the full URL (incl. list params) to come back to it after login.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
