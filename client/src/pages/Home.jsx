import { useEffect, useState, useRef} from 'react';
import { io } from 'socket.io-client';
import { getUsers } from '../api/auth';
import { receiveMessages, sendMessageToDb, getConversationSummaries, deleteMessageFromDb, editMessageInDb } from '../api/messages';
import './Home.css';
import { MessageSquare, CircleArrowOutUpLeft, ChevronDown, Paperclip } from 'lucide-react';
import { uploadImage } from '../api/imguploads';
import { getGroups, createGroup, getGroupMessages, sendGroupMessage} from '../api/groups';
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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteTime, setDeleteTime] = useState(Date.now());
  const [messageMenu, setMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [groups, setGroups] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);// Prevents Double submissions
  const [selectedGroup, setSelectedGroup] = useState(null);

 
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

//Load Summaries (User Object)

useEffect(() => {
  const fetchConversationSummaries = async () => {
    try {
      const { data } =
      await getConversationSummaries(token);

      const previews = {};
      const counts = {};
      data.forEach((summary) => {
        const userId = String(summary.userId);
        previews[userId] = {
          lastMessage: summary.lastMessage,
          createdAt: summary.createdAt
        };

        counts[userId] = summary.unreadCount;
      });

      setChatPrev(previews);
      setUnreadCounts(counts);
    } catch (error) {
      console.log(
        'CONVERSATION SUMMARY ERROR:',
        error
      );
    }
  };

  if (token && currentUserId) {
    fetchConversationSummaries();
  }
}, [token, currentUserId]);

// Dismiss the text delete option after 3 mins

useEffect(() => {
  const latestMessage = messages[messages.length - 1];

  if (!latestMessage?.createdAt) return;
  setDeleteTime(Date.now());
  
  const expiresAt =
  new Date(latestMessage.createdAt).getTime() +
  3 * 60 * 1000;

  const timeRemaining = expiresAt - Date.now();
  if (timeRemaining <= 0) return;
  const timer = setTimeout(() => {
    setDeleteTime(Date.now());
  }, timeRemaining + 100);
  return () => clearTimeout(timer);
}, [messages]);
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

const handleMessageEdited = (updatedMessage) => {
    setMessages((prev) =>
    prev.map((msg) =>
    String(msg._id) === String(updatedMessage._id)
    ? updatedMessage
    :msg
  )
);



const senderId = String(updatedMessage.senderId);

setChatPrev((prev) => ({
  ...prev,
  [senderId]: {
    lastMessage: updatedMessage.text,
    createdAt: updatedMessage.CreatedAt
  }
}));
  };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);
    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('messageStatusUpdated', handleMessageStatusUpdated);
    socket.on('messagesSeen', handleMessagesSeen);
    socket.on('messageEdited', handleMessageEdited);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('messageStatusUpdated',handleMessageStatusUpdated);
      socket.off('messagesSeen', handleMessagesSeen);
    };
  
 }, [selectedUserId]);

useEffect(() => {
  const handleReceiveGroupMessage = (
    newMessage
  ) => {
    console.log(
      'RECEIVED GROUP MESSAGE:',
      newMessage
    );

    const incomingGroupId =
      String(newMessage.groupId);

    const openGroupId =
      String(selectedGroup?._id || '');

    // Only display messages if the group is open
    if (
      incomingGroupId === openGroupId
    ) {
      setMessages((prev) => [
        ...prev,
        newMessage
      ]);

      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  };

  socket.on(
    'receiveGroupMessage',
    handleReceiveGroupMessage
  );

  return () => {
    socket.off(
      'receiveGroupMessage',
      handleReceiveGroupMessage
    );
  };
}, [selectedGroup]);

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

// Load Groups

useEffect(() => {
  const fetchGroups = async () => {
    try {
      const { data } = await getGroups(token);

      setGroups(data);
    } catch (error) {
      console.log('GET GROUPS ERROR:', error);
    }
  };

  if (token && currentUserId) {
    fetchGroups();
  }
}, [token, currentUserId]);

const handleGroupMemberToggle = (userId) => {
  const normalizedId = String(userId);

  setSelectedGroupMembers((prev) => {
    if (prev.includes(normalizedId)) {
      return prev.filter(
        (id) => id !== normalizedId
      );
    }

    return [
      ...prev,
      normalizedId
    ];
  });
};

const handleCreateGroup = async () => {
  console.log('CREATE BUTTON CLICKED');
  console.log('Group DATA:', {
    groupName,
    selectedGroupMembers,
    tokenExists: !!token
  });
  if (!groupName.trim()) {
    console.log('STOPPED: no group name');
    return;
  }

  if (selectedGroupMembers.length === 0) {
    console.log('STOPPED: no members selected');
    return;
  }

  try {
    setCreatingGroup(true);
    console.log('ABOUT TO CALL createGROUP')
    const { data: newGroup } =
    await createGroup(
      {
        name: groupName.trim(),
        members: selectedGroupMembers
      },
      token
    );

    console.log('GROUP RESPONSE:', newGroup);

    //Adds the new group to the UI
    setGroups((prev) => [
      newGroup,
      ...prev
    ]);

    //Reset form
    setGroupName('');
    setSelectedGroupMembers([]);
    setShowCreateGroup(false);
  
  } catch (error) {
    console.log(
      'CREATE GROUP ERROR:',
      error.response?.data || error
    );
  } finally {
    setCreatingGroup(false);
  }
};


// Previews image when image is selected

useEffect(() => {
  if (!selectedImage) {
    setImagePreview('');
    return;
  }

  const previewUrl = URL.createObjectURL(selectedImage);

  setImagePreview(previewUrl);

  return () => {
    URL.revokeObjectURL(previewUrl);
  };
}, [selectedImage]);

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
    setSelectedGroup(null);
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

// Listen for clicks outside of the messageMenu

useEffect(() => {
  if (!messageMenu) return;

  const handleClickAway = () => {
    setMessageMenu(null);
  };

  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      setMessageMenu(null);
    }
  };

  document.addEventListener('click', handleClickAway);
  document.addEventListener('keydown',handleEscape);

  return () => {
    document.removeEventListener('click', handleClickAway);
    document.removeEventListener('keydown', handleEscape);
  };
}, [messageMenu]);

const handleDeleteMessage = async (message) => {
  try {
    await deleteMessageFromDb(
      message._id,
      token
    );
    // Removes the message from the sender

    setMessages((prev) =>
    prev.filter(
      (msg) =>
        String(msg._id) !==String(message._id)
    )
  );

  

  //Remove the message from the recipients screen
   socket.emit('deleteMessage', {
    messageId: message._id,
    receiverId: message.receiverId
   });
  } catch (error) {
    console.log('DELETE MESSAGE ERROR:', error);
  }
};
/* validates input, build a message object, seaves it to the Db, emit it live, adds to the current UI and clears the input */
  const handleSend = async () => {
    if ((!text.trim() && !selectedImage) || !selectedUser) {
      return;
    }

    try {
         let imageUrl = '';

      if (selectedImage) {
        const { data } = await uploadImage(
          selectedImage,
          token
        );

        imageUrl = data.imageUrl;
      }

      
    

    const newMessage = {
      senderId: currentUserId,
      receiverId: selectedUserId,
      text: text.trim(),
      imageUrl
    };

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
      setSelectedImage(null);
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
  // Creates a new user list that displays the most recent message
  const sortedUsers = [...users].sort((a, b) => {
    const aTime = chatPrev[a._id]?.createdAt
    ? new Date (chatPrev[a._id].createdAt).getTime()
    : 0;

    const bTime = chatPrev[b._id]?.createdAt
    ? new Date(chatPrev[b._id].createdAt).getTime()
    : 0;

    return bTime - aTime;
  });

  const handleMessageContextMenu = (
        e,
        message,
        canDelete,
        canEdit
      ) => {
        e.preventDefault();

        const isMyMessage =
        String(message.senderId) === String(currentUserId);

        //Don't open a menu for someone else's message

        if (!isMyMessage) {
          setMessageMenu(null);
          return;
        }

        //Don't open an empty menu when the time has expired

        if (!canDelete && !canEdit) {
          setMessageMenu(null);
          return;
        }

        setMessageMenu({
          message,
          x: e.clientX,
          y: e.clientY,
          canDelete,
          canEdit
        });
      };
      
      const handleSaveEdit = async () => {
        if (!editingMessage || !editText.trim()) {
          return;
        }

        try {
          const { data: updatedMessage } =
          await editMessageInDb(
            editingMessage._id,
            editText,
            token
          );

          setMessages((prev) =>
          prev.map((msg) =>
          String(msg._id) === String(updatedMessage._id)
          ? updatedMessage
          : msg
          )
          );

          setChatPrev((prev) => ({
            ...prev,
            [String(updatedMessage.receiverId)]: {
              lastMessage: updatedMessage.text,
              createdAt: updatedMessage.createdAt
            }
          }));

         socket.emit('editMessage', {
          updatedMessage,
          receiverId: updatedMessage.receiverId
         });
         
         setEditingMessage(null);
         setEditText('');
        } catch (error) {
          console.log(
            'EDIT MESSAGE ERROR:',
            error.response?.data || error
          );
        }
      }

      const handleSelectGroup = async (group) => {
        try {
        setSelectedGroup(group);

        // Close any DM that is currently selected
        setSelectedUser(null);

        // Prevent Old DM messages from remaining on screen
        setMessages([]);
        setText('');
        setIsTyping(false);
        console.log('LOADING GROUP MESSAGES:',
          group._id
        );
        

        const { data } = await getGroupMessages(
          group._id,
          token
        );

        console.log(
          'GROUP MESSAGES LOADED:',
          data
        );


        setMessages(data);
      } catch (error) {
        console.log('GET GROUP MESSAGES ERROR:',
          error.response?.data || errir
        )
      };
    };

    const handleSendGroupMessage = async () => {
      if (!selectedGroup) return;
      
      if (!text.trim() && !selectedImage) {
        return;
      }

      try {
        let imageUrl = '';

        //Image Upload
        if (selectedImage) {
          const { data } = await uploadImage(
            selectedImage,
            token
          );

          imageUrl = data.imageUrl;
        }

        const { data: newMessage } =
        await sendGroupMessage(
          selectedGroup._id,
          {
            text: text.trim(),
            imageUrl
          },
          token
        );

        console.log(
          'GROUP MESSAGE SAVED:',
          newMessage
        );

        socket.emit('sendGroupMessage', {
          groupId: selectedGroup._id,
          messageId: newMessage._id
        });

        setMessages((prev) => [
          ...prev,
          newMessage
        ]);

        setText('');
        setSelectedImage(null);
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      } catch (error) {
        console.log(
          'SEND GROUP MESSAGE ERROR:',
          error.response?.data || error
        );
      }
    };

    useEffect(() => {
      if (!currentUserId || groups.length === 0) {
        return;
      }

      const joinGroupRooms = () => {
        groups.forEach((group) => {
          console.log(
            'JOINING GROUP ROOM:',
            group._id
          );

          socket.emit(
            'joinGroup',
            group._id
          );
        });
      };

      // Join asap if socket is already connected
      if (socket.connected) {
        joinGroupRooms();
      }

      // Rejoin after reconnecting
      socket.on('connect', joinGroupRooms);

      return () => {
        socket.off(
          'connect',
          joinGroupRooms
        );
      };
    }, [groups, currentUserId]);

  const formatChatTime = (createdAt) => {
    if (!createdAt) return '';

    const messageDate = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() -1);

    const isSameDay = (date1, date2) =>
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();

      if (isSameDay(messageDate, today)) {
        return messageDate.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        });
      }

      if (isSameDay(messageDate, yesterday)) {
        return 'Yesterday';
      }

      return messageDate.toLocaleDateString([], {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
      });
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
        
        <button
        className="create-group-button"
        onClick={() => setShowCreateGroup(true)}
        >
          New Group

        </button>

        <div className="search-bar-wrap">
          <input
            className="search-bar"
            type="text"
            placeholder="Search or start a new chat"
            disabled
          />
        </div>

        <div className="chat-list">

          {/* Group chats */}
          {groups.map((group) => (
            <button
            key={group._id}
            className={`chat-list-item ${
              selectedGroup?._id === group._id
              ? 'selected'
              : ''
            }`}
            onClick={() => handleSelectGroup(group)}
            >

              <div className="chat-avatar group-avatar">
                {group.name.charAt(0).toUpperCase()}
              </div>

              <div className="chat-list-content">
                <div className="chat-list-text">
                  <div className="chat-list-top-row">
                    <span className="chat-name">
                      {group.name}
                    </span>

                    {group.updatedAt && (
                      <span className="chat-time">
                        {formatChatTime(group.updatedAt)}
                      </span>
                    )}
                  </div>

                  <span className="chat-preview">
                    Group . {group.members?.length || 0} members

                  </span>
                </div>
              </div>

            </button>
          ))}

          {/* Direct Messages */}
          {sortedUsers.map((user) => (
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
                <div className="chat-list-top-row">
                  
                
                <span className={`chat-name ${
                  unreadCounts[String(user._id)] > 0 ? 'unread' : ''
                }`}
                >
                  {user.username}
                  </span>
                  {chatPrev[user._id]?.createdAt && (
                    <span className="chat-time">
                      {formatChatTime(chatPrev[user._id].createdAt)}
                   
                    </span>
                  )}
                  </div>
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
  {selectedGroup ? (
  <div className="group-conversation">

    <div className="conversation-header">
      <div className="conversation-user">
        <div className="chat-avatar small">
          {selectedGroup.name.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="conversation-meta">
        <h2>{selectedGroup.name}</h2>
        <p>
          {selectedGroup.members?.length || 0} members
        </p>
      </div>
    </div>

    {/* MESSAGES PANEL */}
    <div
      className="messages-panel group-messages-panel"
      ref={messagesPanelRef}
      onScroll={() => {
        const panel = messagesPanelRef.current;

        if (!panel) return;

        const distanceFromBottom =
          panel.scrollHeight -
          panel.scrollTop -
          panel.clientHeight;

        setShowScrollButton(
          distanceFromBottom > 120
        );
      }}
    >
      {messages.map((msg) => {
        const senderId =
          msg.senderId?._id || msg.senderId;

        const isMine =
          String(senderId) ===
          String(currentUserId);

        return (
          <div
            key={msg._id}
            className={`message-row ${
              isMine ? 'mine' : 'theirs'
            }`}
          >
            <div
              className={`message-bubble ${
                isMine ? 'mine' : 'theirs'
              }`}
            >
              {!isMine &&
                msg.senderId?.username && (
                  <span className="group-message-sender">
                    {msg.senderId.username}
                  </span>
                )}

              {msg.imageUrl && (
                <img
                  src={`http://localhost:5000${msg.imageUrl}`}
                  alt="Group attachment"
                  className="message-image"
                />
              )}

              {msg.text && (
                <span className="message-text">
                  {msg.text}
                </span>
              )}

              <div className="message-meta">
                <span className="message-time">
                  {new Date(
                    msg.createdAt
                  ).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>

    {/* Message Composer */}
    <div className="message-composer group-message-composer">
      <textarea
        className="composer-input"
        value={text}
        rows={1}
        onChange={(e) =>
          setText(e.target.value)
        }
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            !e.shiftKey
          ) {
            e.preventDefault();
            handleSendGroupMessage();
          }
        }}
        placeholder={`Message ${selectedGroup.name}`}
      />

      <button
        className="send-button"
        onClick={handleSendGroupMessage}
      >
        Send
      </button>
    </div>

  </div>
) : selectedUser ? (
  <>

      {isTyping && (
        <p className="typing-indicator">{selectedUser.username} is typing...</p>
      )}

      <div className="messages-panel group-messages-panel"
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
          // Scroll Logic for Images
          const isLastMessage = index === messages.length -1;
          const messageAge =
          deleteTime - new Date (msg.createdAt).getTime()
          
          const deleteWindow = messageAge <= 3 * 60 * 1000;
          const canDelete = isMine && isLastMessage && deleteWindow;
          const canEdit =
          isMine &&
          isLastMessage &&
          deleteWindow &&
          Boolean(msg.text?.trim());

          return (
            <div
              key={index}
              className={`message-row ${isMine ? 'mine' : 'theirs'}`}
            >
              <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}
              onContextMenu={(e) =>
              handleMessageContextMenu(
                e,
                msg,
                canDelete,
                canEdit
              )
              }
              >
              {msg.imageUrl && (
                <img
                src={`http://localhost:5000${msg.imageUrl}`}
                alt="Message attachment"
                className="message-image"

                onLoad={() => {
                  if (isLastMessage) {
                    requestAnimationFrame(() => {
                      scrollToBottom('smooth');
                      setShowScrollButton(false);
                    });
                  }
                }}
                />
              )}
                
                 {msg.text && (
                  <span className="message-text">
                    {msg.text}
                  </span>
                 )}
                <div className ="message-meta">
                  {msg.edited && (
                    <span className="edited-label">
                      Edited
                    </span>
                  )}
                <span className="message-time">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                  </span>

                  {isMine && (
                    <span className={`message-status ${msg.status}`}>
                      {msg.status === 'sent' && 'Sent' }
                      {msg.status === 'delivered' && 'Delivered'}
                      {msg.status === 'seen' && 'Read'}
                    </span>
                  )}
                </div>
                
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

      {imagePreview && (
        <div className = "image-preview-container">
        <img
        src={imagePreview}
          alt="Selected attachment"
          className="image-preview"
          />
          
          <button
          type="button"
          className="remove-image-button"
          onClick={() => setSelectedImage(null)}
          >
           × 
          </button>
          </div>
      )}

      <div className="message-composer">
        
        {/* Image picker */}
          <label
        htmlFor="image-upload"
        className="attachment-button"
        title="Attach image"
        >
          <Paperclip size={22} />
        <input
        id="image-upload"
        type="file"
        accept="image/*"
        className="image-file-input"
        onChange={(e) => {
          const file = e.target.files[0];

          if (file) {
            setSelectedImage(file);
          }
        }}
        />
        </label>

        
        

        {/* Text Input */}
        <textarea
          className="composer-input"
          value={text}
          rows={1}
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
            if (e.key === 'Enter' && !e.shiftKey) {
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
{/* Message Menu */}

{messageMenu && (
  <div
    className="message-context-menu"
    style={{
      left: messageMenu.x,
      top: messageMenu.y
    }}
    onClick={(e) => e.stopPropagation()}
  >

    {messageMenu.canEdit && (
      <button
        onClick={() => {
          setEditingMessage(messageMenu.message);
          setEditText(messageMenu.message.text);
          setMessageMenu(null);
        }}
      >
        Edit
      </button>
    )}

    {messageMenu.canDelete && (
      <button
        onClick={() => {
          handleDeleteMessage(messageMenu.message);
          setMessageMenu(null);
        }}
      >
        Delete
      </button>
    )}
  </div>
)}

{/* Edit Modal */}

{editingMessage && (
  <div
    className="edit-modal-backdrop"
    onClick={() => {
      setEditingMessage(null);
      setEditText('');
    }}
  >
    <div
      className="edit-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="edit-modal-header">
        <button
          className="edit-modal-close"
          onClick={() => {
            setEditingMessage(null);
            setEditText('');
          }}
        >
          ×
        </button>

        <span>Edit Message</span>
      </div>

      <div className="edit-modal-preview">
        <div className="edit-preview-bubble">
          <span>{editText}</span>

          <div className="edit-preview-meta">
            <span>Edited</span>

            <span>
              {new Date(
                editingMessage.createdAt
              ).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="edit-modal-composer">
        <textarea
          className="edit-modal-input"
          value={editText}
          autoFocus
          onChange={(e) =>
            setEditText(e.target.value)
          }
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey
            ) {
              e.preventDefault();
              handleSaveEdit();
            }

            if (e.key === 'Escape') {
              setEditingMessage(null);
              setEditText('');
            }
          }}
        />

        <button
          className="edit-save-button"
          onClick={handleSaveEdit}
          disabled={!editText.trim()}
        >
          ✓
        </button>
      </div>
    </div>
  </div>
)}

{/* Group Modal */}

{showCreateGroup && (
  <div
  className="group-modal-backgroup"
  onClick={() => {
    setShowCreateGroup(false);
    setGroupName('');
    setSelectedGroupMembers([]);
  }}
  >
    <div
    className='group-modal'
    onClick={(e) => e.stopPropagation()}
    >
      <div className="group-modal-header">
        <button
        onClick={() => {
          setShowCreateGroup(false);
          setGroupName('');
          setSelectedGroupMembers([]);
        }}
        >
          ×
        </button>

        <h2>New Group</h2>

      </div>

      <input
        className ="group-name-input"
        type="text"
        value={groupName}
        onChange={(e) =>
          setGroupName(e.target.value)
        }
        placeholder="Group name"
      />

      <div className="group-member-list">
        {users.map((user) => {
          const userId = String(user._id);

          const selected = selectedGroupMembers.includes(userId);

          return (
            <button
            key={user._id}
            type="button"
            className={`group-member-item ${
              selected ? 'selected': ''
            }`}
            onClick={() => 
              handleGroupMemberToggle(user._id)
            }
            >
              <div className="chat-avatar small">
                {user.username
                .charAt(0)
                .toUpperCase()}
              </div>

              <span>{user.username}</span>

              <span className="group-member-check">
                {selected ?  '✓' : '' }
              </span>

            </button>
          );
        })}

      </div>

      <button
      className="create-group-submit"
      onClick={handleCreateGroup}
      disabled={
        !groupName.trim() ||
        selectedGroupMembers.length === 0 ||
        creatingGroup
      }
      >

        {creatingGroup
        ? 'Creating...'
      : 'Create Group'}

      </button>

    </div>

  </div>
)}

</div>
);

   
}

export default Home;