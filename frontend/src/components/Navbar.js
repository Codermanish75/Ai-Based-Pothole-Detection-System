import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        🛣️ RoadGuard <span>AI</span>
      </div>
      <div className="nav-right">
        {user && (
          <>
            <span className="nav-user">👤 {user.name}</span>
            <button className="nav-logout" onClick={logout}>Sign Out</button>
          </>
        )}
      </div>
    </nav>
  );
}
