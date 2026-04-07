import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getUsers } from '../api/auth';
import { receiveMessages, sendMessageToDb } from '../api/messages';

const socket = io('http://localhost:5000');

function Home() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (!currentUser) return;

    socket.emit('join', currentUser.id);

    socket.on('receiveMessage', (message) => {
      if (selectedUser && message.senderId === selectedUser._id) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      socket.off('receiveMessage');
    };
  }, [currentUser, selectedUser]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await getUsers(token);
        const filtered = data.filter((user) => user._id !== currentUser.id);
        setUsers(filtered);
      } catch (error) {
        console.log(error);
      }
    };

    if (currentUser && token) {
      fetchUsers();
    }
  }, [token, currentUser]);

  const handleSelectUser = async (user) => {
    setSelectedUser(user);

    try {
      const { data } = await receiveMessages(user._id, token);
      setMessages(data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedUser) return;

    const newMessage = {
      senderId: currentUser.id,
      receiverId: selectedUser._id,
      text
    };

    try {
      await sendMessageToDb(newMessage, token);

      socket.emit('sendMessage', newMessage);

      setMessages((prev) => [
        ...prev,
        { ...newMessage, createdAt: new Date().toISOString() }
      ]);

      setText('');
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
      <div style={{ width: '200px' }}>
        <h2>Users</h2>
        {users.map((user) => (
          <div
            key={user._id}
            onClick={() => handleSelectUser(user)}
            style={{ cursor: 'pointer', marginBottom: '10px' }}
          >
            {user.username}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <h2>
          {selectedUser ? `Chat with ${selectedUser.username}` : 'Select a user'}
        </h2>

        <div
          style={{
            border: '1px solid #ccc',
            minHeight: '300px',
            padding: '10px',
            marginBottom: '10px'
          }}
        >
          {messages.map((msg, index) => (
            <div key={index}>
              <strong>
                {msg.senderId === currentUser.id ? 'You' : selectedUser?.username}:
              </strong>{' '}
              {msg.text}
            </div>
          ))}
        </div>

        {selectedUser && (
          <div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message"
            />
            <button onClick={handleSend}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;