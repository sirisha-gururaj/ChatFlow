import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  FaPlus, FaSignOutAlt, FaPaperPlane, FaUserCircle, FaUsers, 
  FaDoorOpen, FaLock, FaUnlock, FaComments, FaPen, FaCheck, FaTrash,
  FaEye, FaEyeSlash, FaCrown // Added FaCrown for the admin icon
} from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

const ENDPOINT = "http://localhost:5000";
var socket, selectedChatCompare;

const Chat = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState();
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // UI States
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // --- TOOLTIP STATE ---
  const [tooltip, setTooltip] = useState({ visible: false, text: "", top: 0, left: 0 });
  
  // --- MODAL STATES ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({ name: "", description: "", isPrivate: false, password: "" });
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinPassword, setJoinPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // NEW STATE: To track if the modal was triggered by the sidebar delete icon
  const [isSidebarDeleteAction, setIsSidebarDeleteAction] = useState(false);

  // Track which channel is being hovered in sidebar to show delete icon
  const [hoveredChannel, setHoveredChannel] = useState(null);

  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    setUser(userInfo);
    setNewUsername(userInfo?.username || "");
    if (!userInfo) navigate("/auth");

    socket = io(ENDPOINT);
    socket.emit("setup", userInfo);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("online users", (users) => setOnlineUsers(users));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    // --- REAL-TIME UPDATES LISTENERS ---
    
    socket.on("channel deleted", (deletedChannelId) => {
      if (selectedChatCompare && selectedChatCompare._id === deletedChannelId) {
        setIsReadOnly(true);
      }
    });

    socket.on("user updated", (updatedUser) => {
      setMessages((prevMessages) => 
        prevMessages.map((msg) => {
          if (msg.sender && msg.sender._id === updatedUser._id) {
            return { ...msg, sender: { ...msg.sender, username: updatedUser.username } };
          }
          return msg;
        })
      );
      
      setChannels((prevChannels) =>
        prevChannels.map((c) => ({
          ...c,
          members: c.members.map((m) => 
            m._id === updatedUser._id ? { ...m, username: updatedUser.username } : m
          )
        }))
      );

      setCurrentChannel((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) => 
            m._id === updatedUser._id ? { ...m, username: updatedUser.username } : m
          )
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  const refreshChannels = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("http://localhost:5000/api/chat/channels", config);
      setChannels(data);
      if (currentChannel) {
         const updatedCurrent = data.find(c => c._id === currentChannel._id);
         if(updatedCurrent) setCurrentChannel(updatedCurrent);
      }
    } catch (error) {
      console.error("Failed to load channels");
    }
  };

  useEffect(() => {
    if (user) refreshChannels();
  }, [user]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentChannel) return;
      
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get(
          `http://localhost:5000/api/chat/message/${currentChannel._id}?page=1`,
          config
        );
        
        if (data.messages) {
          setMessages(data.messages);
          setHasMore(data.messages.length === 20);
          setIsReadOnly(data.isDeleted);
        } else {
          setMessages(data); 
        }
        
        setPage(1);
        socket.emit("join chat", currentChannel._id);
        selectedChatCompare = currentChannel;
        
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
      } catch (error) {
        console.error("Failed to load messages");
      }
    };
    fetchMessages();
  }, [currentChannel, user]);

  // --- ACTIONS ---

  const handleJoinClick = () => {
    if (currentChannel.isPrivate) {
      setJoinPassword("");
      setShowPassword(false);
      setShowJoinModal(true);
    } else {
      submitJoinChannel(null);
    }
  };

  const submitJoinChannel = async (passwordToUse) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(
        "http://localhost:5000/api/chat/channel/join",
        { channelId: currentChannel._id, password: passwordToUse },
        config
      );
      setShowJoinModal(false);
      refreshChannels();
    } catch (error) {
      alert(error.response?.data?.message || "Error joining channel");
    }
  };

  // Triggered from Header "Door" Icon
  const handleLeaveClick = () => {
    setIsSidebarDeleteAction(false); // It's a normal leave action
    setShowLeaveModal(true);
  };

  // Triggered from Sidebar "Trash" Icon
  const handleSidebarDelete = (e, channel) => {
    e.stopPropagation();
    setCurrentChannel(channel); 
    setIsSidebarDeleteAction(true); // It's a sidebar delete action
    setShowLeaveModal(true); 
  };

  const submitLeaveChannel = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(
        "http://localhost:5000/api/chat/channel/leave",
        { channelId: currentChannel._id },
        config
      );
      
      // Remove that channel from the list completely for this specific user
      setChannels(prevChannels => prevChannels.filter(c => c._id !== currentChannel._id));
      
      setCurrentChannel(null); 
      setShowLeaveModal(false);
    } catch (error) {
      alert("Error leaving channel");
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const submitDeleteChannel = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`http://localhost:5000/api/chat/channel/${currentChannel._id}`, config);
      socket.emit("delete channel", currentChannel._id);
      setIsReadOnly(true);
      setShowDeleteModal(false);
    } catch (error) {
      alert("Error deleting channel");
    }
  };

  const sendMessage = async (e) => {
    if (e.key === "Enter" && newMessage) {
      e.preventDefault();
      socket.emit("stop typing", currentChannel._id);
      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        setNewMessage("");
        const { data } = await axios.post(
          "http://localhost:5000/api/chat/message",
          { content: newMessage, channelId: currentChannel._id },
          config
        );
        socket.emit("new message", data);
        setMessages([...messages, data]);
      } catch (error) {
        console.error("Failed to send message");
        alert("Could not send message");
      }
    }
  };

  const handleCreateClick = () => {
    setCreateData({ name: "", description: "", isPrivate: false, password: "" });
    setShowCreateModal(true);
  };

  const submitCreateChannel = async (e) => {
    e.preventDefault();
    if (createData.isPrivate && !createData.password) {
      alert("Password is required for private channels");
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(
        "http://localhost:5000/api/chat/channel",
        createData,
        config
      );
      setChannels([...channels, data]);
      setShowCreateModal(false);
      setCurrentChannel(data);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create channel");
    }
  };

  const saveUsername = async () => {
    if (!newUsername.trim()) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(
        "http://localhost:5000/api/user/rename",
        { newName: newUsername },
        config
      );
      localStorage.setItem("userInfo", JSON.stringify(data));
      setUser(data);
      setIsEditingName(false);
      socket.emit("user updated", { _id: user._id, username: newUsername });
    } catch (error) {
      alert("Failed to update username");
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore) {
      loadMoreMessages();
      e.target.scrollTop = 10; 
    }
  };

  const loadMoreMessages = async () => {
     try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const nextPage = page + 1;
      const { data } = await axios.get(
        `http://localhost:5000/api/chat/message/${currentChannel._id}?page=${nextPage}`,
        config
      );
      const newMsgs = data.messages || data; 
      if (newMsgs.length > 0) {
        setMessages(prev => [...newMsgs, ...prev]);
        setPage(nextPage);
        setHasMore(newMsgs.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (error) { console.error("Error loading more"); }
  };

  useEffect(() => {
    socket.on("message received", (newMessageReceived) => {
      if (!selectedChatCompare || selectedChatCompare._id !== newMessageReceived.channel._id) {
        // notification
      } else {
        setMessages([...messages, newMessageReceived]);
      }
    });
  });

  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!socketConnected) return;
    if (!typing) {
      setTyping(true);
      socket.emit("typing", currentChannel._id);
    }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", currentChannel._id);
        setTyping(false);
      }
    }, timerLength);
  };

  const isMember = currentChannel?.members.some(m => m._id === user?._id);
  const isAdmin = currentChannel?.admin === user?._id;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <div className="w-64 bg-gray-900 text-white flex flex-col border-r border-gray-800 flex-shrink-0">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h1 className="text-xl font-bold tracking-wider text-indigo-400">ChatFlow</h1>
          <button onClick={handleCreateClick} className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white" title="Create Channel">
            <FaPlus />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Channels
          </div>
          {channels.map((channel) => (
            <div
              key={channel._id}
              onClick={() => setCurrentChannel(channel)}
              onMouseEnter={() => setHoveredChannel(channel._id)}
              onMouseLeave={() => setHoveredChannel(null)}
              className={`flex items-center px-3 py-2 cursor-pointer rounded-lg transition-colors group relative ${
                currentChannel?._id === channel._id ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              {channel.isPrivate ? (
                <FaLock className="mr-2 text-sm opacity-60 text-yellow-500" />
              ) : (
                <FaComments className="mr-2 text-sm opacity-60" />
              )}
              <span className="truncate font-medium flex-1">{channel.name}</span>
              
              {/* Delete Icon on Hover */}
              {hoveredChannel === channel._id && (
                <button
                  onClick={(e) => handleSidebarDelete(e, channel)}
                  className="p-1 hover:text-red-400 transition"
                  title="Delete Channel"
                >
                  <FaTrash size={10} />
                </button>
              )}

              {/* Active Indicator (if not hovered) */}
              {hoveredChannel !== channel._id && channel.members.some(m => m._id === user?._id) && (
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 ml-2"></div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold relative flex-shrink-0">
              {user?.username?.charAt(0).toUpperCase()}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
            </div>
            
            <div className="ml-3 truncate flex-1">
              {isEditingName ? (
                <div className="flex items-center">
                  <input 
                    type="text" 
                    className="w-full bg-gray-700 text-white text-xs px-1 py-0.5 rounded outline-none border border-indigo-500"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                    autoFocus
                  />
                  <FaCheck className="ml-2 text-green-400 cursor-pointer hover:text-green-300" onClick={saveUsername} size={12}/>
                </div>
              ) : (
                <div className="group flex items-center cursor-pointer" onClick={() => setIsEditingName(true)} title="Click to edit username">
                  <p className="text-sm font-medium text-white truncate hover:text-indigo-300 transition">
                    {user?.username}
                  </p>
                  <FaPen className="ml-2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition" />
                </div>
              )}
              <p className="text-xs text-gray-400">Online</p>
            </div>
          </div>
          <button onClick={() => {localStorage.removeItem("userInfo"); navigate("/auth")}} className="text-gray-400 hover:text-red-400 transition ml-2" title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white min-w-0">
        {currentChannel ? (
          <>
            <div className="h-16 px-6 border-b flex items-center justify-between bg-white shadow-sm z-10">
              <div className="flex items-center overflow-hidden">
                {currentChannel.isPrivate ? (
                  <FaLock className="text-yellow-500 mr-2 flex-shrink-0" />
                ) : (
                  <FaComments className="text-gray-400 mr-2 flex-shrink-0" />
                )}
                <h2 
                  className="text-lg font-bold text-gray-800 truncate mr-4 cursor-help"
                  onMouseEnter={(e) => {
                    if (currentChannel.description) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        visible: true,
                        text: currentChannel.description,
                        top: rect.bottom + 5, 
                        left: rect.left
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip({ ...tooltip, visible: false })}
                >
                  {currentChannel.name}
                </h2>
                <button 
                  onClick={() => {
                    if (currentChannel.isPrivate && !isMember) {
                      return; 
                    }
                    setShowMembersModal(true);
                  }} 
                  className={`flex items-center text-xs bg-gray-100 px-2 py-1 rounded-md transition ${
                    currentChannel.isPrivate && !isMember 
                      ? "text-gray-400 cursor-not-allowed opacity-60" 
                      : "text-gray-500 hover:text-indigo-600 cursor-pointer"
                  }`}
                  title={currentChannel.isPrivate && !isMember ? "Join to view members" : "View members"}
                >
                  <FaUsers className="mr-1" />
                  {currentChannel.members.length} members
                </button>
              </div>
              
              <div className="flex items-center">
                {isAdmin && (
                  <button 
                    onClick={handleDeleteClick} 
                    disabled={isReadOnly}
                    className={`transition p-2 rounded-full mr-2 ${isReadOnly ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}
                    title={isReadOnly ? "Channel already deleted" : "Delete Channel"}
                  >
                    <FaTrash />
                  </button>
                )}
                {isMember && (
                  <button onClick={handleLeaveClick} className="text-gray-400 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50" title="Leave Channel">
                    <FaDoorOpen />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4" ref={chatContainerRef} onScroll={handleScroll}>
              {hasMore && messages.length > 0 && <div className="text-center text-xs text-gray-400">Loading history...</div>}
              
              {messages.map((m, i) => {
                const isMe = m.sender._id === user._id;
                const isOnline = onlineUsers.includes(m.sender._id);
                const displayName = isMe ? user.username : m.sender.username;

                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <div className="relative w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs mr-2 mt-1 flex-shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white z-10"></div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"}`}>
                      {!isMe && <p className="text-xs text-gray-400 font-bold mb-1">{displayName}</p>}
                      <div className="flex flex-wrap items-end gap-x-2">
                        <p className="text-sm leading-relaxed break-words">{m.content}</p>
                        <span className={`text-[10px] whitespace-nowrap mb-0.5 ml-auto ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && <div className="text-xs text-gray-500 italic ml-2">Someone is typing...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
              {isReadOnly ? (
                <div className="w-full py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-center border-2 border-dashed border-gray-300">
                   This channel has been deleted by the admin.
                </div>
              ) : isMember ? (
                <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2">
                  <input type="text" placeholder={`Message ${currentChannel.name}`} className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 py-2 min-w-0" value={newMessage} onChange={typingHandler} onKeyDown={sendMessage} />
                  <button onClick={(e) => sendMessage({ key: 'Enter', preventDefault: () => {} })} className="ml-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md">
                    <FaPaperPlane />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                   <button onClick={handleJoinClick} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-[1.01] flex items-center justify-center">
                    {currentChannel.isPrivate && <FaLock className="mr-2" />}
                    {currentChannel.isPrivate ? "Join Private Channel" : `Join ${currentChannel.name}`}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center p-8">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
               <FaUserCircle className="text-5xl text-indigo-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to ChatFlow</h2>
            <p className="text-gray-500">Select a channel or create one to begin.</p>
          </div>
        )}
      </div>

      {/* --- TOOLTIP COMPONENT --- */}
      {tooltip.visible && (
        <div 
            className="fixed z-50 bg-gray-800 text-white text-xs px-3 py-2 rounded-md shadow-xl border border-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
            style={{ top: tooltip.top, left: tooltip.left }}
        >
            {tooltip.text}
        </div>
      )}

      {showMembersModal && currentChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-700">Members of {currentChannel.name}</h3>
              <button onClick={() => setShowMembersModal(false)} className="text-gray-400 hover:text-gray-600"><IoMdClose size={24} /></button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {currentChannel.members.map(member => (
                <div key={member._id} className="flex items-center py-2 border-b border-gray-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-700 font-medium">{member.username}</span>
                  
                  {/* ADMIN BADGE */}
                  {currentChannel.admin === member._id && (
                     <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-bold uppercase flex items-center">
                       <FaCrown className="mr-1 text-[9px]"/> Admin
                     </span>
                  )}

                  {member._id === user._id && <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">You</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold text-gray-800">Create Channel</h2>
               <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><IoMdClose size={24} /></button>
            </div>
            <form onSubmit={submitCreateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                <div className="flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                   <FaComments className="text-gray-400 mr-2" />
                   <input type="text" className="flex-1 outline-none text-gray-700" placeholder="general" value={createData.name} onChange={(e) => setCreateData({...createData, name: e.target.value})} required autoFocus />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" rows="2" placeholder="What is this channel about?" value={createData.description} onChange={(e) => setCreateData({...createData, description: e.target.value})}></textarea>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                   {createData.isPrivate ? <FaLock className="text-yellow-500 mr-2" /> : <FaUnlock className="text-gray-400 mr-2" />}
                   <span className="text-gray-700 font-medium">Private Channel</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={createData.isPrivate} onChange={(e) => setCreateData({...createData, isPrivate: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              {createData.isPrivate && (
                 <div className="animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" value={createData.password} onChange={(e) => setCreateData({...createData, password: e.target.value})} required />
                 </div>
              )}
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition mt-2">Create Channel</button>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <FaLock className="text-2xl text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Private Channel</h3>
              <p className="text-gray-500 mb-6 text-sm">Enter the password to join <span className="font-bold">{currentChannel?.name}</span></p>
              
              <div className="relative mb-4">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full border rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none text-center" 
                  placeholder="Enter Password" 
                  value={joinPassword} 
                  onChange={(e) => setJoinPassword(e.target.value)} 
                  autoFocus 
                  onKeyDown={(e) => e.key === 'Enter' && submitJoinChannel(joinPassword)} 
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  type="button"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <div className="flex space-x-3">
                 <button onClick={() => setShowJoinModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                 <button onClick={() => submitJoinChannel(joinPassword)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm">Join</button>
              </div>
           </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isSidebarDeleteAction ? "bg-red-100" : "bg-red-100"}`}>
                 {isSidebarDeleteAction ? (
                    <FaTrash className="text-2xl text-red-600" />
                 ) : (
                    <FaSignOutAlt className="text-2xl text-red-500" />
                 )}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                 {isSidebarDeleteAction ? "Delete Channel?" : "Leave Channel?"}
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                 Are you sure you want to leave <span className="font-bold">{currentChannel?.name}</span>{isSidebarDeleteAction ? " before deleting?" : "?"}
              </p>
              <div className="flex space-x-3">
                 <button onClick={() => setShowLeaveModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                 <button onClick={submitLeaveChannel} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm">
                    {isSidebarDeleteAction ? "Delete" : "Leave"}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <FaTrash className="text-2xl text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Channel?</h3>
              <p className="text-gray-500 mb-4 text-sm">This will delete the channel for everyone. <br/><span className="text-xs text-red-500">(Users can read history but not send)</span></p>
              <div className="flex space-x-3">
                 <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                 <button onClick={submitDeleteChannel} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm">Delete</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Chat;