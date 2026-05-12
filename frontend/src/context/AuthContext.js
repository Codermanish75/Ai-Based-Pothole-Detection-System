import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('rg_user')) || null; } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('rg_token') || null);

  const saveSession = (userData, jwtToken) => {
    localStorage.setItem('rg_user',  JSON.stringify(userData));
    localStorage.setItem('rg_token', jwtToken);
    setUser(userData);
    setToken(jwtToken);
  };

  const clearSession = () => {
    localStorage.removeItem('rg_user');
    localStorage.removeItem('rg_token');
    setUser(null);
    setToken(null);
  };

  // ── signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(async (name, email, password) => {
    const res  = await fetch(`${API_URL}/api/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Signup failed.');
    saveSession(data.user, data.token);
    return data;
  }, []);

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res  = await fetch(`${API_URL}/api/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Login failed.');
    saveSession(data.user, data.token);
    return data;
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore network errors on logout */ }
    clearSession();
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
