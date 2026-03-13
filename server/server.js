const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dotenv.config();

// Fail fast instead of buffering DB operations when not connected
mongoose.set('bufferCommands', false);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/notifications', require('./routes/notifications'));

// Doctor Clinical Dashboard (MediDash) — API + static frontend
app.use('/api/doctor-panel', require('./routes/doctor-panel'));
app.use('/doctor-panel', express.static(path.join(__dirname, '..', 'doctor')));
app.get('/doctor-panel/signin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'doctor', 'login.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MedTrack AI Server is running' });
});

async function startServer() {
  try {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        tlsAllowInvalidCertificates: true, // Dev-only TLS bypass
        serverSelectionTimeoutMS: 10000
      });
    } catch (err) {
      const dnsBlocked = err?.code === 'ECONNREFUSED' && (err?.syscall === 'querySrv' || err?.syscall === 'queryA');
      if (!dnsBlocked) throw err;

      console.warn('⚠️ Atlas DNS lookup failed. Retrying with public DNS resolvers (1.1.1.1, 8.8.8.8)...');
      dns.setServers(['1.1.1.1', '8.8.8.8']);

      await mongoose.connect(process.env.MONGODB_URI, {
        tlsAllowInvalidCertificates: true,
        serverSelectionTimeoutMS: 10000
      });
    }

    console.log('✅ Connected to MongoDB Atlas');
    const { initCronJobs } = require('./utils/cronJobs');
    initCronJobs();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(` MedTrack AI Server running on port ${PORT}`);
      console.log(`========================================`);
    });
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
}

startServer();
