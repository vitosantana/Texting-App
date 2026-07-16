const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();


const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

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

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

const onlineUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    onlineUsers[userId] = socket.id;
     console.log('user joined socket map:', userId, socket.id);
  });

  socket.on('sendMessage', ({ senderId, receiverId, text }) => {
    const receiverSocketId = onlineUsers[receiverId];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receiveMessage', {
        senderId,
        receiverId,
        text,
        createdAt: new Date()
      });
    }
  });

  // Typing Indicator
socket.on('typing', ({ senderId, receiverId }) => {
   console.log('SERVER typing received:', { senderId, receiverId });
  console.log('onlineUsers map:', onlineUsers);
  const receiverSocketId = onlineUsers[receiverId];
  if (receiverSocketId) {
       console.log('SERVER forwarding typing to:', receiverSocketId);
    io.to(receiverSocketId).emit('typing', {senderId});
  } else {
    console.log('receiver not online for typing event');
  }
});

socket.on('stopTyping', ({ senderId, receiverId }) => {
  console.log('stopTyping event received:', senderId, receiverId);
   console.log('onlineUsers map:', onlineUsers);
  const receiverSocketId = onlineUsers[receiverId];

  if (receiverSocketId) {
    console.log('forwarding stopTyping to socket:', receiverSocketId);
    io.to(receiverSocketId).emit('stopTyping', { senderId});
  } else {
    console.log('receiver not online for stopTyping event');
  }
});

  socket.on('disconnect', () => {
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

