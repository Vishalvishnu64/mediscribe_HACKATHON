const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { vapidPublicKey } = require('../utils/cronJobs');

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// Save subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const subscription = req.body;
    
    // Validate subscription object (simplified check)
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    await User.findByIdAndUpdate(req.user.id, { pushSubscription: subscription });
    
    res.status(201).json({ success: true, message: 'Push subscription saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update nominee details
router.put('/nominee', auth, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nominee name and email are required' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 'nominee.name': name, 'nominee.email': email, 'nominee.phone': phone || '' },
      { new: true }
    ).select('-passwordHash');
    res.json({ success: true, nominee: user.nominee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get nominee details
router.get('/nominee', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('nominee');
    res.json({ nominee: user.nominee || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove nominee
router.delete('/nominee', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $unset: { nominee: 1 } });
    res.json({ success: true, message: 'Nominee removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save push subscription for nominee (called from nominee's device)
router.post('/nominee/subscribe', async (req, res) => {
  try {
    const { patientEmail, subscription } = req.body;
    if (!patientEmail || !subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Patient email and valid subscription required' });
    }
    const patient = await User.findOne({ email: patientEmail, role: 'PATIENT' });
    if (!patient || !patient.nominee || !patient.nominee.email) {
      return res.status(404).json({ error: 'No nominee configured for this patient' });
    }
    await User.findByIdAndUpdate(patient._id, { 'nominee.pushSubscription': subscription });
    res.status(201).json({ success: true, message: 'Nominee push subscription saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
