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

module.exports = router;
