const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MedTrack AI Server is running' });
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  tlsAllowInvalidCertificates: true // For dev testing, bypasses internal TLS alert if IP is not whitelisted flawlessly
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  const { initCronJobs } = require('./utils/cronJobs');
  initCronJobs();
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` MedTrack AI Server running on port ${PORT}`);
  console.log(`========================================`);
});
