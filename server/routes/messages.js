const express = require('express');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
     console.log('POST /messages body:', req.body);

    const { senderId, receiverId, text, imageUrl} = req.body;

    const message = await Message.create({
      senderId,
      receiverId,
      text,
      imageUrl,
      status: 'sent'
    });

    console.log('Saved message:', message);

    res.status(201).json(message);
  } catch (error) {

    console.log('MESSAGE POST ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/conversation-summaries', authMiddleware, async (req, res) => {
 try {
  const currentUserId = String(req.user.userId);
  // Find every message involving the logged in user
  const messages = await Message.find({
    $or: [
      {senderId: currentUserId },
      { receiverId: currentUserId }
    ]
  })

  .sort({ createdAt: -1 })
  // Converts Mongoose documents into plain objects
  .lean();

  const summaries = {};

  for (const message of messages) {
    const senderId = String(message.senderId);
    const receiverId = String(message.receiverId);
    const otherUserId =
    senderId === currentUserId
    ? receiverId
    : senderId;

    //Display the latest message

    if (!summaries[otherUserId]) {
      summaries[otherUserId] = {
        userId: otherUserId,
        lastMessage: message.text || (message.imageUrl ? 'Photo' : ''),
        createdAt: message.createdAt,
        unreadCount: 0
      };
    }
    // Count unseen messages sent to the logged in user
    if (
      receiverId === currentUserId && message.status !== 'seen'
    ) {
      summaries[otherUserId].unreadCount += 1;
    }
  }

  res.json(Object.values(summaries));
 } catch (error) {
  console.log(
    'CONVERSATION SUMMARY ERROR:',
    error
  );

  res.status(500).json({
    message: 'Server error'
  });
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