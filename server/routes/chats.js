const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');
const ChatRequest = require('../models/ChatRequest');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Connection = require('../models/Connection');

const CHAT_TTL_HOURS = 24;

const chatUploadDir = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatUploadDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
  }
});

const uploadChatImage = multer({
  storage: chatStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

const markExpiredIfNeeded = async (chat) => {
  if (!chat) return chat;
  if (chat.status === 'ACCEPTED' && chat.expiresAt && new Date(chat.expiresAt) <= new Date()) {
    chat.status = 'EXPIRED';
    await chat.save();
  }
  return chat;
};

const ensureAccess = async (chatId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) return null;
  const chat = await ChatRequest.findById(chatId);
  if (!chat) return null;
  const uid = String(userId);
  if (String(chat.patientId) !== uid && String(chat.doctorId) !== uid) return null;
  await markExpiredIfNeeded(chat);
  return chat;
};

// Patient requests chat with doctor
router.post('/request/:doctorId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) return res.status(400).json({ error: 'Invalid doctor id' });

    const doctor = await User.findOne({ _id: doctorId, role: 'DOCTOR' }).select('_id name');
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const existing = await ChatRequest.findOne({ patientId: req.user.id, doctorId }).sort({ createdAt: -1 });
    if (existing) {
      await markExpiredIfNeeded(existing);
      if (existing.status === 'PENDING') {
        return res.json({ request: existing, message: 'Chat request already pending' });
      }
      if (existing.status === 'ACCEPTED' && existing.expiresAt && new Date(existing.expiresAt) > new Date()) {
        return res.json({ request: existing, message: 'Active chat already exists' });
      }
    }

    const created = await ChatRequest.create({
      patientId: req.user.id,
      doctorId,
      status: 'PENDING',
      requestedBy: 'PATIENT'
    });

    res.status(201).json({ request: created, message: 'Chat request sent to doctor' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient checks latest chat status with one doctor
router.get('/patient/doctor/:doctorId/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) return res.status(400).json({ error: 'Invalid doctor id' });

    const latest = await ChatRequest.findOne({ patientId: req.user.id, doctorId }).sort({ createdAt: -1 });
    if (!latest) return res.json({ status: 'NONE', requestId: null });

    await markExpiredIfNeeded(latest);

    return res.json({
      status: latest.status,
      requestId: latest._id,
      expiresAt: latest.expiresAt || null,
      updatedAt: latest.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient conversation list with latest chat status per doctor
router.get('/patient/conversations', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const linkedDoctorIds = await Connection.find({
      patientId: req.user.id,
      status: { $in: ['APPROVED', 'CORRECTED'] }
    }).distinct('doctorId');

    // Also include doctors from existing chat history so conversations remain visible
    // even if a Connection row is missing/old.
    const chatDoctorIds = await ChatRequest.find({ patientId: req.user.id }).distinct('doctorId');
    const doctorIdSet = new Set(
      [...(linkedDoctorIds || []), ...(chatDoctorIds || [])]
        .filter(Boolean)
        .map((id) => String(id))
    );

    const allDoctorIds = [...doctorIdSet];

    const doctors = allDoctorIds.length
      ? await User.find({ _id: { $in: allDoctorIds }, role: 'DOCTOR' }).select('name profilePic')
      : [];

    const out = [];
    for (const doctor of doctors) {
      const latest = await ChatRequest.findOne({ patientId: req.user.id, doctorId: doctor._id }).sort({ createdAt: -1 });
      if (latest) await markExpiredIfNeeded(latest);

      const status = latest?.status || 'NONE';
      let lastMessage = '';
      let lastMessageAt = latest?.updatedAt || latest?.createdAt || null;

      if (latest?._id) {
        const lm = await ChatMessage.findOne({ chatRequestId: latest._id }).sort({ createdAt: -1 }).select('text imageUrl createdAt');
        if (lm) {
          lastMessage = lm.text || (lm.imageUrl ? '📷 Image' : '');
          lastMessageAt = lm.createdAt;
        }
      }

      out.push({
        doctorId: doctor._id,
        peer: {
          id: doctor._id,
          name: doctor.name,
          profilePic: doctor.profilePic || null,
        },
        status,
        requestId: latest?._id || null,
        expiresAt: latest?.expiresAt || null,
        lastMessage,
        lastMessageAt: lastMessageAt || null,
      });
    }

    out.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Doctor gets pending chat requests (notification list)
router.get('/doctor/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DOCTOR') return res.status(403).json({ error: 'Unauthorized' });

    const rows = await ChatRequest.find({ doctorId: req.user.id, status: 'PENDING' })
      .populate('patientId', 'name age gender profilePic')
      .sort({ createdAt: -1 });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Doctor accepts / denies request
router.patch('/requests/:id/decision', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DOCTOR') return res.status(403).json({ error: 'Unauthorized' });

    const { action } = req.body;
    const chat = await ChatRequest.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Request not found' });
    if (String(chat.doctorId) !== String(req.user.id)) return res.status(403).json({ error: 'Unauthorized' });

    await markExpiredIfNeeded(chat);

    const next = String(action || '').toUpperCase();
    if (!['ACCEPT', 'DENY'].includes(next)) return res.status(400).json({ error: 'Invalid action' });
    if (chat.status !== 'PENDING') return res.status(400).json({ error: 'Request is already processed' });

    if (next === 'ACCEPT') {
      const now = new Date();
      const expires = new Date(now.getTime() + CHAT_TTL_HOURS * 60 * 60 * 1000);
      chat.status = 'ACCEPTED';
      chat.acceptedAt = now;
      chat.expiresAt = expires;
      await chat.save();
      return res.json({ request: chat, message: 'Chat accepted' });
    }

    chat.status = 'DENIED';
    chat.deniedAt = new Date();
    await chat.save();
    return res.json({ request: chat, message: 'Chat denied' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List active chats for both doctor/patient
router.get('/my-chats', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'DOCTOR'
      ? { doctorId: req.user.id, status: 'ACCEPTED' }
      : { patientId: req.user.id, status: 'ACCEPTED' };

    const rows = await ChatRequest.find(filter)
      .populate('doctorId', 'name profilePic')
      .populate('patientId', 'name profilePic')
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    const validRows = [];
    for (const row of rows) {
      await markExpiredIfNeeded(row);
      if (row.status === 'ACCEPTED' && (!row.expiresAt || new Date(row.expiresAt) > new Date())) {
        validRows.push(row);
      }
    }

    const ids = validRows.map((r) => r._id);
    const latestMessages = ids.length
      ? await ChatMessage.aggregate([
          { $match: { chatRequestId: { $in: ids } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$chatRequestId', text: { $first: '$text' }, imageUrl: { $first: '$imageUrl' }, at: { $first: '$createdAt' } } }
        ])
      : [];

    const latestMap = new Map(latestMessages.map((m) => [String(m._id), m]));

    const out = validRows.map((r) => {
      const peer = req.user.role === 'DOCTOR' ? r.patientId : r.doctorId;
      const lm = latestMap.get(String(r._id));
      return {
        id: r._id,
        peer: {
          id: peer?._id,
          name: peer?.name || 'User',
          profilePic: peer?.profilePic || null,
        },
        expiresAt: r.expiresAt,
        lastMessage: lm?.text || (lm?.imageUrl ? '📷 Image' : ''),
        lastMessageAt: lm?.at || r.updatedAt,
      };
    });

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages in one chat
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const chat = await ensureAccess(req.params.id, req.user.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.status !== 'ACCEPTED') return res.status(400).json({ error: 'Chat is not active' });
    if (chat.expiresAt && new Date(chat.expiresAt) <= new Date()) return res.status(400).json({ error: 'Chat expired' });

    const rows = await ChatMessage.find({ chatRequestId: chat._id }).sort({ createdAt: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message
router.post('/:id/messages', auth, uploadChatImage.single('image'), async (req, res) => {
  try {
    const chat = await ensureAccess(req.params.id, req.user.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (chat.status !== 'ACCEPTED') return res.status(400).json({ error: 'Chat is not active' });
    if (chat.expiresAt && new Date(chat.expiresAt) <= new Date()) return res.status(400).json({ error: 'Chat expired' });

    const text = String(req.body?.text || '').trim();
    const imageUrl = req.file ? `/uploads/chat/${req.file.filename}` : '';
    if (!text && !imageUrl) return res.status(400).json({ error: 'Message text or image is required' });

    const msg = await ChatMessage.create({
      chatRequestId: chat._id,
      senderId: req.user.id,
      senderRole: req.user.role,
      text,
      imageUrl,
    });

    chat.lastMessageAt = new Date();
    await chat.save();

    res.status(201).json(msg);
  } catch (err) {
    if (String(err?.message || '').toLowerCase().includes('only image files')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
