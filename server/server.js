const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config({ override: true });

console.log('*** MY CURRENT SERVER.JS IS RUNNING ***');
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const Message = require('./models/Message');
const uploadRoutes = require('./routes/uploads');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

const onlineUsers = {};
//Connects to Socket.IO
io.on('connection', (socket) => {
  socket.on('deleteMessage', ({ messageId, receiverId }) => {
    const receiverSocketId = 
    onlineUsers[String(receiverId)];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit('messageDeleted', {
        messageId
      });
    }
  });
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    //converts the user Id into a string
    const normalizedUserId = String(userId);
    onlineUsers[normalizedUserId] = socket.id;
     console.log('user joined socket map:', {
      userId: normalizedUserId,
      socketId: socket.id
     });

     console.log('Online users:', onlineUsers);

     io.emit('onlineUsers', Object.keys(onlineUsers));

   
      
  });


  socket.on('sendMessage', async (message) => {
    try {
      const messageId = String(message._id);
      const senderId = String(message.senderId);
      const receiverId = String(message.receiverId);

      const receiverSocketId = onlineUsers[String(receiverId)];
      const senderSocketId = onlineUsers[senderId];

      // Recipient is currently connected
      if (receiverSocketId) {
        const deliveredMessage = await Message.findByIdAndUpdate(
          messageId,
          {
            status: 'delivered'
          },
          {
            new: true
          }
        );

        if (!deliveredMessage) {
          console.log('Message not found:', messageId);
          return;
        }

        // Send the delivered message to the recipient
        io.to(receiverSocketId).emit(
          'receiveMessage',
          deliveredMessage
        );

        //Notify the sender that the message was delivered
        if (senderSocketId) {
          io.to(senderSocketId).emit('messageStatusUpdated', {
            messageId,
            status: 'delivered'
          });
        }

        console.log('Message delivered:', messageId);
        return;
      }

      // Message status remains sent because recipient is offline
      console.log(
        'Recipient offline. Message remains sent:',
        messageId
      );
    } catch (error) {
      console.log('sendMessage socket error:', error);
    }
  });

  // Replace old message with newer edited message
socket.on('editMessage', ({ updatedMessage, receiverId }) => {
  const receiverSocketId = onlineUsers[String(receiverId)];

  if (receiverSocketId) {
    io.to(receiverSocketId).emit(
      'messageEdited',
      updatedMessage
    );
  }
});

  socket.on('markMessagesSeen', async ({ senderId, receiverId }) => {
    try {
      // Find unseen messages from the receiving user
      const messagesToMark = await Message.find({
        senderId,
        receiverId,
        status: { $ne: 'seen' }
      }).select('id');

      if (messagesToMark.length ===0) {
        return;
      }
      
      const messageIds = messagesToMark.map((message) =>
      String(message._id)
    );

    //Update those messages in MongoDB
    await Message.updateMany(
      {
        _id: { $in: messageIds }
      },
      {
        $set: {
          status: 'seen'
        }
      }
    );

    console.log('Messages marked as seen:', messageIds);

    //Find the original sender's active socket
    const senderSocketId = onlineUsers[String(senderId)];

    console.log('SEEN DEBUG:', {
      senderId: String(senderId),
      senderSocketId,
      onlineUsers
    });

    //Tell the sender that these messages were seen
    if (senderSocketId) {
      console.log(
        'Emitting messagesSeen to:',
        senderSocketId,
        messageIds
      );
      io.to(senderSocketId).emit('messagesSeen', {
        messageIds
      });
    } else {
      console.log('Could not find sender spcket for:', senderId);
    }
    } catch (error) {
      console.log('markMessagesSeen error:', error);
    }
  });

  // Typing Indicator
socket.on('typing', ({ senderId, receiverId }) => {
   console.log('SERVER typing received:', { senderId, receiverId });
  const receiverSocketId = onlineUsers[String(receiverId)];
  if (receiverSocketId) {
    io.to(receiverSocketId).emit('typing', {senderId});
  } else {
    console.log('receiver not online for typing event');
  }
});

socket.on('stopTyping', ({ senderId, receiverId }) => {
  console.log('stopTyping event received:', senderId, receiverId);
  const receiverSocketId = onlineUsers[receiverId];

  if (receiverSocketId) {
    console.log('forwarding stopTyping to socket:', receiverSocketId);
    io.to(receiverSocketId).emit('stopTyping', { senderId});
  } else {
    console.log('receiver not online for stopTyping event');
  }
});

  socket.on('disconnect', () => {
    let disconnectedUserId = null;
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        disconnectedUserId = userId;
        delete onlineUsers[userId];
        break;
      }
    }
    console.log('User disconnected:', {
      userId: disconnectedUserId,
      socketId: socket.id
    });
    console.log('Online users:', onlineUsers);

    io.emit('onlineUsers', Object.keys(onlineUsers));
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));