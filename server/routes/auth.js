const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// Signup Route
router.post('/signup', async (req, res) => {
  try {
    const { role, name, email, password, ...rest } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create new user
    user = new User({ role, name, email, passwordHash, ...rest });
    await user.save();
    
    // Generate token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        role,
        name,
        email,
        profilePic: user.profilePic,
        settings: user.settings,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Check user & role match
    const user = await User.findOne({ email, role });
    if (!user) return res.status(400).json({ error: 'Invalid credentials or role' });
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    
    // Generate token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        settings: user.settings,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User Profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Current User Profile / Settings
router.patch('/me', auth, async (req, res) => {
  try {
    const allowedFields = [
      'name',
      'age',
      'gender',
      'medicalConditions',
      'allergies',
      'emergencyContact',
      'profilePic',
      'nominee'
    ];

    const update = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });

    if (req.body.settings !== undefined) {
      update.settings = {
        ...(req.body.settings || {}),
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
