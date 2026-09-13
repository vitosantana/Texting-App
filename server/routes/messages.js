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

router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = String(req.user.userId);
    const messageId = req.params.messageId;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        message: 'Message not found'
      });
    }

    // Only the sender can delete the message
    if ( String(message.senderId) !== currentUserId) {
      return res.status(403).json({
        message: 'You cannot delete this message'
      });
    }

    const threeMinutes = 3 * 60 * 1000;
    const messageAge = Date.now() - new Date(message.createdAt).getTime();

    if (messageAge > threeMinutes) {
      return res.status(403).json({
        message: 'The delete window has expired'
      });
    }

    const latestMessage = await Message.findOne({
      $or: [
        {
          senderId: message.senderId,
          receiverId: message.receiverId
        },
        {
          senderId: message.senderId,
          receiverId: message.receiverId
        },
        {
          senderId: message.receiverId,
          receiverId: message.senderId
        }
      ]
    }).sort({
      createdAt: -1,
      _id: -1
    });

    if (
      !latestMessage ||
      String(latestMessage._id) !== String(message._id)
    ) {
      return res.status(403).json({
        message: 'Only the most recent message can be deleted'
      });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({
      message: 'Message deleted',
      messageId
    });
  } catch (error) {
    console.log('DELETE MESSAGE ERROR:', error);

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

router.patch('/:messageId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = String(req.user.userId);
    const messageId = req.params.messageId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.staus(400).json({
        message: 'Message cannot be empty'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: 'Message not found'
      });
    }

    // Ensures the sender is the editor

    if (String(message.senderId) !== currentUserId) {
      return res.status(403).json({
        message: 'You cannot edit this message'
      });
    }

    // Only text message can be edited
    if (!message.text) {
      return res.status(400).json({
        message: 'The edit window has expired'
      });
    }

    // Ensures its the most recent message

    const latestMessage = await Message.findOne({
      $or: [
        {
          senderId: message.senderId,
          receiverId: message.receiverId
        },
        {
          senderId: message.receiverId,
          receiverId: message.senderId
        }
      ]
    }).sort({
      createdAt: -1,
      _id: -1
    });

    if (
      !latestMessage ||
      String(latestMessage._id) !== String(message._id)
    ) {
      return res.status(403).json({
        message: 'Only the most recent message can be edited'
      });
    }

    message.text = text.trim();
    message.edited = true;
    await message.save();
    res.json(message);
  } catch (error) {
    console.log('EDIT MESSAGE ERROR:', error);

    res.status(500).json({
      message: 'Server error'
    });
  }
});

module.exports = router;