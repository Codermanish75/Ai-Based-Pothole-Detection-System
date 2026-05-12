import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage  from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard  from './pages/Dashboard';
import Navbar     from './components/Navbar';

function AppContent() {
  const { user } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (!user) {
    return showSignup
      ? <SignupPage onSwitch={() => setShowSignup(false)} />
      : <LoginPage  onSwitch={() => setShowSignup(true)} />;
  }

  return (
    <>
      <Navbar />
      <Dashboard />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
