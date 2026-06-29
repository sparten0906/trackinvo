import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Boxes } from 'lucide-react';

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--ground)' }}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-faint)' }}>
          <Boxes size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <div
          className="absolute -inset-1 rounded-2xl border-2 animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', borderRightColor: 'transparent' }}
        />
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>Loading TrackInvo…</p>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
