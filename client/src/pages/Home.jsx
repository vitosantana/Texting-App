import { useEffect, useState, useRef} from 'react';
import { io } from 'socket.io-client';
import { getUsers } from '../api/auth';
import { receiveMessages, sendMessageToDb } from '../api/messages';
import './Home.css';
import { MessageSquare, CircleArrowOutUpLeft, ChevronDown } from 'lucide-react';

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
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesPanelRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  

 
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
      const senderId = String(message.senderId);
      const activeUserId = selectedUserId 
      ? String(selectedUserId) : null;

      //Update the chat preview
      setChatPrev((prev) => ({
        ...prev,
        [senderId]: {
          lastMessage: message.text,
          createdAt: message.createdAt
        }
      }));
      // Checks if the received message belongs to the current conversation
      if (activeUserId === senderId) {
        setMessages((prev) => [...prev, message]);

        socket.emit('markMessagesSeen', {
          senderId: message.senderId,
          receiverId: currentUserId
        });

        return;
      }

      //Increase unread count when the conversation isn't open
      setUnreadCounts((prev) => ({
        ...prev,
        [senderId]: (prev[senderId] || 0) + 1
      }));
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

    const handleOnlineUsers = (userIds) => {
      console.log('Online user IDS received:', userIds);

      setOnlineUserIds(
        userIds.map((userId) => String(userId))
      );
    };
    
const handleMessageStatusUpdated = ({ messageId, status }) => {
  setMessages((prev) =>
    prev.map((msg) =>
      String(msg._id) === String(messageId)
        ? { ...msg, status }
        : msg
    )
  );
};

const handleMessagesSeen = ({ messageIds }) => {
  setMessages((prev) =>
    prev.map((msg) =>
      messageIds.includes(String(msg._id))
        ? { ...msg, status: 'seen' }
        : msg
    )
  );
};

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);
    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('messageStatusUpdated', handleMessageStatusUpdated);
    socket.on('messagesSeen', handleMessagesSeen);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('messageStatusUpdated',handleMessageStatusUpdated);
      socket.off('messagesSeen', handleMessagesSeen);
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

//Scrolls to the nearest message whenever messages change

const scrollToBottom = (behavior = 'smooth') => {
  messagesEndRef.current?.scrollIntoView({
    behavior,
    block: 'end'
  });
};

useEffect(() => {
  const panel = messagesPanelRef.current;

  if (!panel) return;

  const distanceFromBottom = 
  panel.scrollHeight - panel.scrollTop - panel.clientHeight;

  const isNearBottom = distanceFromBottom < 120;

  if (isNearBottom) {
    scrollToBottom('smooth');
  } else {
    setShowScrollButton(true);
  }
}, [messages]);

  const handleSelectUser = async (user) => {
  if (selectedUserId && text.trim()) {
    socket.emit('stopTyping', {
      senderId: currentUserId,
      receiverId: selectedUserId
    });
  }

  setUnreadCounts((prev) => ({
    ...prev,
    [String(user._id)]: 0
  }));

  setSelectedUser(user);
  setText('');
  setIsTyping(false);

  try {
    const { data } = await receiveMessages(user._id, token);

    setMessages(data);
    socket.emit('markMessagesSeen', {
      senderId: user._id,
      receiverId: currentUserId
    });

    requestAnimationFrame(() => {
      scrollToBottom('auto');
    });

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

    const newMessage = {
      senderId: currentUserId,
      receiverId: selectedUserId,
      text
    };

    try {
      const {data: savedMessage } = await sendMessageToDb(
        newMessage,
        token
      );

      socket.emit('sendMessage', savedMessage);
      
      socket.emit('stopTyping', {
        senderId: currentUserId,
        receiverId: selectedUserId
      });

  

      setMessages((prev) => [
        ...prev,
        savedMessage
      ]);

      setChatPrev((prev) => ({
        ...prev,
        [selectedUser._id]: {
          lastMessage: savedMessage.text,
          createdAt: savedMessage.createdAt
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
console.log('onlineUserIds:', onlineUserIds);
console.log('selectedUserId:', selectedUserId);
  const selectedUserIsOnline = selectedUserId && onlineUserIds.includes(String(selectedUserId));

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

              <div className="chat-list-content">

              <div className="chat-list-text">
                <span className={`chat-name ${
                  unreadCounts[String(user._id)] > 0 ? 'unread' : ''
                }`}
                >
                  {user.username}
                  </span>
                <span className={`chat-preview ${
                  unreadCounts[String(user._id)] > 0 ? 'unread' : ''
                }`}
                >
                  {chatPrev[user._id]?.lastMessage || 'Tap to open chat'}
                </span>
              </div>

              {unreadCounts[String(user._id)] > 0 && (
                <span className = "unread-count">
                  {unreadCounts[String(user._id)] > 99
                  ? '99+'
                : unreadCounts[String(user._id)]}
                </span>
              )}
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
          <p>{selectedUserIsOnline ? 'Online' : 'Offline'}</p>
        </div>
      </div>

      {isTyping && (
        <p className="typing-indicator">{selectedUser.username} is typing...</p>
      )}

      <div className="messages-panel"
        ref={messagesPanelRef}
        onScroll={() => {
          const panel = messagesPanelRef.current;

          if (!panel) return;

          const distanceFromBottom =
          panel.scrollHeight - panel.scrollTop - panel.clientHeight;

          setShowScrollButton(distanceFromBottom > 120);
        }}
        >
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

                  {isMine && (
                    <span className={`message-status ${msg.status}`}>
                      {msg.status === 'sent' && '✓' }
                      {msg.status === 'delivered' && '✓✓'}
                      {msg.status === 'seen' && '✓✓'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
      {showScrollButton && (
        <button
        className="scroll-to-bottom-button"
        onClick={() => {
          scrollToBottom('smooth');
          setShowScrollButton(false);
        }}
        aria-label="Scroll to newest message"
        >
          <ChevronDown size={22} />

        </button>
      )}

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

          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
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