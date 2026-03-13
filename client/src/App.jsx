import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import PatientDashboard from './pages/patient/PatientDashboard';
import UploadPrescription from './pages/patient/UploadPrescription';
import ActiveMeds from './pages/patient/ActiveMeds';
import MedicalHistory from './pages/patient/MedicalHistory';
import Reminders from './pages/patient/Reminders';
import Settings from './pages/patient/Settings';
import DoctorsDirectory from './pages/patient/DoctorsDirectory';
import DoctorProfile from './pages/patient/DoctorProfile';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorPatients from './pages/doctor/DoctorPatients';
import DoctorPatientProfile from './pages/doctor/DoctorPatientProfile';
import DoctorAlerts from './pages/doctor/DoctorAlerts';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import DoctorDataHub from './pages/doctor/DoctorDataHub';
import DoctorSettings from './pages/doctor/DoctorSettings';
import NomineeSubscribe from './pages/NomineeSubscribe';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/nominee-subscribe" element={<NomineeSubscribe />} />

          {/* Patient Routes */}
          <Route element={<ProtectedRoute allowedRoles={['PATIENT']} />}>
            <Route path="/patient/dashboard" element={<PatientDashboard />} />
            <Route path="/patient/prescriptions" element={<UploadPrescription />} />
            <Route path="/patient/medications" element={<ActiveMeds />} />
            <Route path="/patient/reminders" element={<Reminders />} />
            <Route path="/patient/history" element={<MedicalHistory />} />
            <Route path="/patient/settings" element={<Settings />} />
            <Route path="/patient/doctors" element={<DoctorsDirectory />} />
            <Route path="/patient/doctors/:doctorId" element={<DoctorProfile />} />
          </Route>

          {/* Doctor Routes */}
          <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
            <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="/doctor/patients" element={<DoctorPatients />} />
            <Route path="/doctor/patients/:patientId" element={<DoctorPatientProfile />} />
            <Route path="/doctor/alerts" element={<DoctorAlerts />} />
            <Route path="/doctor/appointments" element={<DoctorAppointments />} />
            <Route path="/doctor/data-hub" element={<DoctorDataHub />} />
            <Route path="/doctor/settings" element={<DoctorSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
