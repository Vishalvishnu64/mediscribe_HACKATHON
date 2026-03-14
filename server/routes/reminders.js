const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const CustomReminder = require('../models/CustomReminder');
const User = require('../models/User');

function toReminderDate(date, time) {
  const d = String(date || '').trim();
  const t = String(time || '').trim();
  if (!d || !t) return null;
  const value = new Date(`${d}T${t}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

router.get('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const reminders = await CustomReminder.find({ patientId: req.user.id })
      .sort({ remindAt: 1 })
      .populate('createdById', 'name profilePic role');

    res.json(
      reminders.map((r) => ({
        _id: r._id,
        text: r.text,
        remindAt: r.remindAt,
        status: r.status,
        createdByRole: r.createdByRole,
        createdBy: r.createdById
          ? {
              id: r.createdById._id,
              name: r.createdById.name,
              role: r.createdById.role,
              profilePic: r.createdById.profilePic || null,
            }
          : null,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load reminders' });
  }
});

router.post('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const text = String(req.body?.text || '').trim();
    const remindAt = req.body?.remindAt || toReminderDate(req.body?.date, req.body?.time);

    if (!text) return res.status(400).json({ error: 'Reminder text is required' });
    const remindDate = new Date(remindAt);
    if (Number.isNaN(remindDate.getTime())) return res.status(400).json({ error: 'Valid reminder date and time are required' });

    const reminder = await CustomReminder.create({
      patientId: req.user.id,
      createdById: req.user.id,
      createdByRole: 'PATIENT',
      text,
      remindAt: remindDate,
      status: 'SCHEDULED',
    });

    const me = await User.findById(req.user.id).select('name profilePic role');

    res.status(201).json({
      _id: reminder._id,
      text: reminder.text,
      remindAt: reminder.remindAt,
      status: reminder.status,
      createdByRole: reminder.createdByRole,
      createdBy: me
        ? {
            id: me._id,
            name: me.name,
            role: me.role,
            profilePic: me.profilePic || null,
          }
        : null,
      createdAt: reminder.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create reminder' });
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid reminder id' });

    const nextStatus = String(req.body?.status || '').toUpperCase();
    if (!['SCHEDULED', 'DONE', 'CANCELLED'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const reminder = await CustomReminder.findOneAndUpdate(
      { _id: id, patientId: req.user.id },
      { status: nextStatus },
      { new: true }
    ).populate('createdById', 'name profilePic role');

    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    res.json({
      _id: reminder._id,
      text: reminder.text,
      remindAt: reminder.remindAt,
      status: reminder.status,
      createdByRole: reminder.createdByRole,
      createdBy: reminder.createdById
        ? {
            id: reminder.createdById._id,
            name: reminder.createdById.name,
            role: reminder.createdById.role,
            profilePic: reminder.createdById.profilePic || null,
          }
        : null,
      createdAt: reminder.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update reminder' });
  }
});

module.exports = router;
