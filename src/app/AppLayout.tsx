import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { logout, useSession } from '../auth/session';

export function AppLayout() {
  const session = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setLoggingOut(true);
    void logout();
  };

  return (
    <>
      <header className="app-header">
        <Link to="/webhooks" className="brand">
          Webhooks
        </Link>
        {session.status === 'authenticated' && (
          <div className="user">
            <span title={session.user.email}>{session.user.name}</span>
            <button type="button" onClick={handleLogout} disabled={loggingOut}>
              Вийти
            </button>
          </div>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}
