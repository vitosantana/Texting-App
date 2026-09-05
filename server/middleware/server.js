const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();


const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
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

app.use(
  '/uploads',
  express.static('uploads')
);
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

const onlineUsers = {};
//Connects to Socket.IO
io.on('connection', (socket) => {
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


  socket.on('sendMessage', ({ senderId, receiverId, text }) => {
    const receiverSocketId = onlineUsers[String(receiverId)];

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

