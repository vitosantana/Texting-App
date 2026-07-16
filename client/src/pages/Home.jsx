import { useEffect, useState} from 'react';
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
  const [chatPrev,setChatPrev] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const currentUserId = currentUser?.id || currentUser?._id;
  const selectedUserId = selectedUser?._id;
  

 
// Connect/reconnect and join effect
useEffect(() => {
  if (!currentUserId) return;
  
  const joinSocket = () => {
    console.log('Joining socket as:', currentUserId, socket.id);
    socket.emit('join', currentUserId);
  };

  const handleDisconnect = () => {
    console.log('Socket disconnected');
  };

  //The socket may already be connected before this effect runs
  if (socket.connected) {
    joinSocket();
  } else {
    socket.connect();
  }

  //Rejoin if Socket.IO reconnected with a new socket ID
  socket.on('connect', joinSocket);
  socket.on('disconnect', handleDisconnect);

  return () => {
    socket.off('connect', joinSocket);
    socket.off('disconnect', handleDisconnect);
  };
}, [currentUserId]);
 //Message and typing listeners

 useEffect(() => {
    const handleReceiveMessage = (message) => {
      if (
        selectedUserId &&
        String(message.senderId) === String(selectedUserId)
      ) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleTyping = ({ senderId }) => {
      if (
        selectedUserId &&
        String(senderId) === String(selectedUserId)
      ) {
        setIsTyping(true);

        }

      };

    const handleStopTyping = ({ senderId }) => {
      if (
        selectedUserId &&
        String(senderId) === String(selectedUserId)
      ) {
        setIsTyping(false);

      }
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
    };
  
 }, [selectedUserId]);
//Loads the list of users 
useEffect(() => {
  const fetchUsers = async () => {
    try {
      const { data } = await getUsers(token);

      const filtered = data.filter(
        (user) => String(user._id) !== String(currentUserId)
      );

      setUsers(filtered);
    } catch (error) {
      console.log(error);
    }
  };

  if (currentUserId && token) {
    fetchUsers();
  }
}, [token, currentUserId]);

  const handleSelectUser = async (user) => {
  if (selectedUserId && text.trim()) {
    socket.emit('stopTyping', {
      senderId: currentUserId,
      receiverId: selectedUserId
    });
  }

  setSelectedUser(user);
  setText('');
  setIsTyping(false);

  try {
    const { data } = await receiveMessages(user._id, token);
    console.log('Fetched messages:', data);

    setMessages(data);

    if (data.length > 0) {
      const last = data[data.length - 1];

      setChatPrev((prev) => ({
        ...prev,
        [user._id]: {
          lastMessage: last.text,
          createdAt: last.createdAt
        }
      }));
    }
  } catch (error) {
    console.log(error);
  }
};
/* validates input, build a message object, seaves it to the Db, emit it live, adds to the current UI and clears the input */
  const handleSend = async () => {
    if (!text.trim() || !selectedUser) return;

    const timestamp= new Date().toISOString();

    const newMessage = {
      senderId: currentUserId,
      receiverId: selectedUserId,
      text
    };

    try {
      await sendMessageToDb(newMessage, token);

      socket.emit('sendMessage', newMessage);
      
      socket.emit('stopTyping', {
        senderId: currentUserId,
        receiverId: selectedUserId
      });

  

      setMessages((prev) => [
        ...prev,
        { ...newMessage, createdAt: timestamp }
      ]);

      setChatPrev((prev) => ({
        ...prev,
        [selectedUser._id]: {
          lastMessage: newMessage.text,
          createdAt: timestamp
        }
      }));

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
                <span className="chat-preview">
                  {chatPrev[user._id]?.lastMessage || 'Tap to open chat'}
                </span>
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
        </div>

        <div className="conversation-meta">
          <h2>{selectedUser.username}</h2>
          <p>Online</p>
        </div>
      </div>

      {isTyping && (
        <p className="typing-indicator">{selectedUser.username} is typing...</p>
      )}

      <div className="messages-panel">
        {messages.map((msg, index) => {
          const isMine = String(msg.senderId) === String(currentUserId);

          return (
            <div
              key={index}
              className={`message-row ${isMine ? 'mine' : 'theirs'}`}
            >
              <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
                <span className="message-text">{msg.text}</span>
                <span className="message-time">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="message-composer">
        <input
          className="composer-input"
          value={text}
          onChange={(e) => {
            const value = e.target.value;
            setText(value);

            if (!currentUserId || !selectedUserId) return; 
              console.log('Emitting typing', {
                senderId: currentUserId,
                receiverId: selectedUserId,
                 connected: socket.connected,
  socketId: socket.id
                
              });

              if (value.trim()) {
                socket.emit('typing', {
                  senderId: currentUserId,
                  receiverId: selectedUserId
                });
              } else {
                socket.emit('stopTyping', {
                  senderId: currentUserId,
                  receiverId: selectedUserId
                });
              }
              
          }}
          placeholder="Type a message"
        />
        <button className="send-button" onClick={handleSend}>
          Send
        </button>
      </div>
    </>
  ) : (
    <div className="empty-conversation">
      <h2>Welcome to chat</h2>
      <p>Select a conversation from the left.</p>
    </div>
  )}
</main>
    </div>
  );
}

export default Home;