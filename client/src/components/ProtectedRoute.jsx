import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // If user is not logged in, boot to landing
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If a specific role is required and user doesnt match
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Re-route to their respective dashboard
    if (user.role === 'PATIENT') return <Navigate to="/patient/dashboard" replace />;
    if (user.role === 'DOCTOR') return <Navigate to="/doctor/dashboard" replace />;
  }

  // Render child routes
  return <Outlet />;
};
