const express = require('express');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authmiddleware');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { senderId, receiverId, text } = req.body;

    const message = await Message.create({
      senderId,
      receiverId,
      text
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;