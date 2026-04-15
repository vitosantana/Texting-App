import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getUsers } from '../api/auth';
import { receiveMessages, sendMessageToDb } from '../api/messages';
import './Home.css';
import { MessageSquare, CircleArrowOutUpLeft } from 'lucide-react';

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
    // Enables the backend to map user IDS to socket IDS
    socket.emit('join', currentUser.id);
    //Listens for live incoming messages from the backend
    socket.on('receiveMessage', (message) => {
      /* Only do something if a user is selected
      and only add the message if it came from the user whose chat is currently open*/
      if (selectedUser && String (message.senderId) === String(selectedUser._id)) {
        setMessages((prev) => [...prev, message]);
      }
    });
// removes the listener
    return () => {
      socket.off('receiveMessage');
    };
  }, [currentUser, selectedUser]);
//Loads the list of users 
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
      console.log('Fetched messages:', data);
      setMessages(data);
    } catch (error) {
      console.log(error);
    }
  };
/* validates input, build a message object, seaves it to the Db, emit it live, adds to the current UI and clears the input */
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <div className="app-frame">
      <aside className="icon-sidebar">
        <div className="icon-sidebar-top">
          <button className="icon-btn active" title="Chats">
          <MessageSquare />  
          </button>
        </div>

        <div className="icon-sidebar-bottom">
          <button className="icon-btn" onClick={handleLogout} title="Logout">
            <CircleArrowOutUpLeft />
          </button>
        </div>
      </aside>

      <section className="chat-list-panel">
        <div className="chat-list-header">
          <h1>Chats</h1>
          <p className="logged-in-user">@{currentUser?.username}</p>
        </div>

        <div className="search-bar-wrap">
          <input
            className="search-bar"
            type="text"
            placeholder="Search or start a new chat"
            disabled
          />
        </div>

        <div className="chat-list">
          {users.map((user) => (
            <button
              key={user._id}
              className={`chat-list-item ${
                selectedUser?._id === user._id ? 'selected' : ''
              }`}
              onClick={() => handleSelectUser(user)}
            >
              <div className="chat-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>

              <div className="chat-list-text">
                <span className="chat-name">{user.username}</span>
                <span className="chat-preview">Tap to open chat</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <main className="conversation-panel">
        {selectedUser ? (
          <>
            <div className="conversation-header">
              <div className="conversation-user">
                <div className="chat-avatar small">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>{selectedUser.username}</h2>
                  <p>Online</p>
                </div>
              </div>
            </div>

            <div className="messages-panel">
              {messages.map((msg, index) => {
                const isMine = String(msg.senderId) === String(currentUser.id);

                return (
                  <div
                    key={index}
                    className={`message-row ${isMine ? 'mine' : 'theirs'}`}
                  >
                    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="message-composer">
              <input
                className="composer-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
              />
              <button className="send-button" onClick={handleSend}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="empty-conversation">
            <h2>Welcome to Chat</h2>
            <p>Select a conversation from the left.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default Home;