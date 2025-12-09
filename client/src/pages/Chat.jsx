import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  FaPlus, FaSignOutAlt, FaPaperPlane, FaUserCircle, FaUsers, 
  FaDoorOpen, FaLock, FaUnlock, FaComments, FaPen, FaCheck, FaTrash,
  FaEye, FaEyeSlash, FaCrown, FaSearch, FaTimes, FaChevronDown, FaSun, FaMoon
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
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  
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
  
  // --- DELETE MESSAGE MODAL STATE ---
  const [showMsgDeleteModal, setShowMsgDeleteModal] = useState(false);
  const [msgToDeleteId, setMsgToDeleteId] = useState(null);
  
  const [isSidebarDeleteAction, setIsSidebarDeleteAction] = useState(false);

  // Track which channel is being hovered in sidebar
  const [hoveredChannel, setHoveredChannel] = useState(null);
  
  // Track message hover and menu state
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // --- TYPING STATE ---
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(""); 
  const [isTyping, setIsTyping] = useState(false);

  // --- GLOBAL SEARCH STATE ---
  const [isSidebarSearchOpen, setIsSidebarSearchOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState([]);

  // --- EDIT MESSAGE STATE ---
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState("");

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
    
    socket.on("typing", (username) => {
       setTypingUser(username);
       setIsTyping(true);
    });
    socket.on("stop typing", () => {
       setIsTyping(false);
       setTypingUser("");
    });

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

    socket.on("message updated", (updatedMessage) => {
        setMessages(prev => prev.map(m => m._id === updatedMessage._id ? updatedMessage : m));
    });

    socket.on("message deleted", (deletedMsgId) => {
        setMessages(prev => prev.filter(m => m._id !== deletedMsgId));
    });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode);
  }, [isDarkMode]);

  // GLOBAL SEARCH EFFECT
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (sidebarSearchQuery.trim()) {
        try {
          const config = { headers: { Authorization: `Bearer ${user.token}` } };
          const { data } = await axios.get(
            `http://localhost:5000/api/chat/search?search=${sidebarSearchQuery}`,
            config
          );
          setGlobalSearchResults(data);
        } catch (error) {
          console.error("Search failed", error);
        }
      } else {
        setGlobalSearchResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [sidebarSearchQuery, user]);

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

  const fetchMessages = async (reset = false) => {
      if (!currentChannel) return;
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const pageNum = reset ? 1 : page;
        
        // Removed local search query from here as requested
        const url = `http://localhost:5000/api/chat/message/${currentChannel._id}?page=${pageNum}`;
        const { data } = await axios.get(url, config);
        
        if (reset) {
           setMessages(data.messages || data);
           setPage(1);
           setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
        } else {
           const newMsgs = data.messages || data;
           if (newMsgs.length > 0) {
             setMessages(prev => [...newMsgs, ...prev]);
             setPage(pageNum);
           }
        }

        setHasMore((data.messages || data).length === 20);
        setIsReadOnly(data.isDeleted);
        
        if(reset) {
           socket.emit("join chat", currentChannel._id);
           selectedChatCompare = currentChannel;
        }

      } catch (error) {
        console.error("Failed to load messages");
      }
  };

  useEffect(() => {
    fetchMessages(true);
    setEditingMessageId(null);
    setMenuOpenId(null);
  }, [currentChannel, user]); // Removed searchQuery dependency


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

  const handleLeaveClick = () => {
    setIsSidebarDeleteAction(false); 
    setShowLeaveModal(true);
  };

  const handleSidebarDelete = (e, channel) => {
    e.stopPropagation();
    setCurrentChannel(channel); 
    setIsSidebarDeleteAction(true); 
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

  // --- MESSAGING ---

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

  // --- EDIT & DELETE MESSAGE ---

  const toggleMessageMenu = (e, msgId) => {
    e.stopPropagation(); // Prevent global click handler from closing immediately
    setMenuOpenId(menuOpenId === msgId ? null : msgId);
  };

  const handleEditMessage = (msg) => {
     if(msg.isDeletedForAll) return; // Prevent editing deleted messages
     setEditingMessageId(msg._id);
     setEditContent(msg.content);
     setMenuOpenId(null);
  };

  const submitEditMessage = async (e) => {
     if(e.key === "Enter" && editContent.trim()) {
        try {
           const config = { headers: { Authorization: `Bearer ${user.token}` } };
           const { data } = await axios.put(
             "http://localhost:5000/api/chat/message/edit",
             { messageId: editingMessageId, content: editContent },
             config
           );
           setMessages(prev => prev.map(m => m._id === editingMessageId ? data : m));
           socket.emit("update message", data);
           setEditingMessageId(null);
        } catch (error) {
           alert("Failed to edit message");
        }
     } else if (e.key === "Escape") {
        setEditingMessageId(null);
     }
  };

  const handleVerifyDelete = (messageId) => {
     setMsgToDeleteId(messageId);
     setShowMsgDeleteModal(true);
     setMenuOpenId(null);
  };

  const confirmDeleteMessage = async (deleteType) => {
     try {
        const config = { 
           headers: { Authorization: `Bearer ${user.token}` },
           data: { deleteType } 
        };
        
        const { data } = await axios.delete(`http://localhost:5000/api/chat/message/${msgToDeleteId}`, config);
        
        if (deleteType === "me") {
             setMessages(prev => prev.filter(m => m._id !== msgToDeleteId));
        } else {
             setMessages(prev => prev.map(m => m._id === msgToDeleteId ? data.message : m));
             socket.emit("update message", data.message);
        }
        
        setShowMsgDeleteModal(false);
        setMsgToDeleteId(null);
     } catch (error) {
        alert("Failed to delete message");
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
       setPage(prev => prev + 1);
       loadMoreMessages();
       e.target.scrollTop = 10; 
    }
  };

  const loadMoreMessages = async () => {
     try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const nextPage = page + 1;
      // Removed local search query
      const url = `http://localhost:5000/api/chat/message/${currentChannel._id}?page=${nextPage}`;
      const { data } = await axios.get(url, config);
      
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

  const handleSearchResultClick = (channelId) => {
     const targetChannel = channels.find(c => c._id === channelId);
     if (targetChannel) {
        setCurrentChannel(targetChannel);
        setIsSidebarSearchOpen(false); // Close search to show chat
        setSidebarSearchQuery(""); // Clear query
     }
  };

  const isMember = currentChannel?.members.some(m => m._id === user?._id);
  const isAdmin = currentChannel?.admin === user?._id;

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${
      isDarkMode 
        ? "bg-gray-950 text-white" 
        : "bg-white text-gray-900"
    }`}>
      <div className={`w-64 flex flex-col border-r flex-shrink-0 transition-colors duration-300 ${
        isDarkMode
          ? "bg-gray-900 text-white border-gray-800"
          : "bg-white text-gray-900 border-orange-100"
      }`}>
        <div className={`p-4 border-b flex justify-between items-center transition-colors duration-300 ${
          isDarkMode
            ? "bg-gray-900 border-gray-800"
            : "bg-white border-orange-200"
        }`}>
          {isSidebarSearchOpen ? (
             <div className={`flex items-center w-full animate-in fade-in zoom-in duration-200 rounded-lg overflow-hidden ${
               isDarkMode ? "bg-gray-800" : "bg-gray-100"
             }`}>
                <input 
                   type="text" 
                   placeholder="Search..." 
                   className={`flex-1 text-sm px-3 py-2 outline-none border-none focus:ring-0 ${
                     isDarkMode 
                       ? "bg-gray-800 text-white placeholder-gray-400" 
                       : "bg-gray-100 text-gray-900 placeholder-gray-500"
                   }`}
                   value={sidebarSearchQuery}
                   onChange={(e) => setSidebarSearchQuery(e.target.value)}
                   autoFocus
                />
                <button 
                   onClick={() => { setIsSidebarSearchOpen(false); setSidebarSearchQuery(""); }} 
                   className={`px-3 py-2 flex items-center justify-center transition-colors ${
                     isDarkMode
                       ? "text-gray-400 hover:text-white hover:bg-gray-700"
                       : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                   }`}
                >
                   <FaTimes size={14} />
                </button>
             </div>
          ) : (
             <>
               <h1 className={`text-xl font-bold tracking-wider transition-colors duration-300 ${
                 isDarkMode 
                   ? "text-[#f6d365]" 
                   : "text-[#fda085]"
               }`}>ChatFlow</h1>
               <div className="flex items-center gap-1">
                  <button onClick={() => setIsSidebarSearchOpen(true)} className={`p-2 rounded-full transition ${
                    isDarkMode
                      ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                      : "hover:bg-orange-50 text-gray-500 hover:text-[#fda085]"
                  }`} title="Search Messages">
                    <FaSearch size={14}/>
                  </button>
                  <button onClick={handleCreateClick} className={`p-2 rounded-full transition ${
                    isDarkMode
                      ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                      : "hover:bg-orange-50 text-gray-500 hover:text-[#fda085]"
                  }`} title="Create Channel">
                    <FaPlus />
                  </button>
               </div>
             </>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto p-2 space-y-1 transition-colors duration-300 ${
          isDarkMode
            ? "bg-gray-900/30"
            : "bg-white"
        }`}>
          {isSidebarSearchOpen && sidebarSearchQuery ? (
             // --- SEARCH RESULTS VIEW ---
             <>
               <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
                  isDarkMode
                    ? "text-gray-500"
                    : "text-gray-400"
               }`}>
                  Search Results
               </div>
               {globalSearchResults.length === 0 ? (
                  <div className={`text-center text-xs mt-4 transition-colors duration-300 ${
                    isDarkMode
                      ? "text-gray-500"
                      : "text-gray-400"
                  }`}>No matching messages</div>
               ) : (
                  globalSearchResults.map((msg) => (
                     <div 
                        key={msg._id} 
                        onClick={() => handleSearchResultClick(msg.channel._id)}
                        className={`p-3 mb-1 cursor-pointer rounded-lg transition ${
                          isDarkMode
                            ? "bg-gray-800 hover:bg-gray-700"
                            : "bg-[#fda085]/10 hover:bg-[#fda085]/20 border border-[#fda085]/30"
                        }`}
                     >
                        <div className="flex justify-between items-baseline mb-1">
                           <span className={`font-bold text-xs truncate max-w-[60%] transition-colors duration-300 ${
                             isDarkMode
                               ? "text-[#f6d365]"
                               : "text-[#fda085]"
                           }`}>{msg.sender.username}</span>
                           <span className={`text-[10px] transition-colors duration-300 ${
                             isDarkMode
                               ? "text-gray-500"
                               : "text-gray-400"
                           }`}>{new Date(msg.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className={`text-xs truncate transition-colors duration-300 ${
                          isDarkMode
                            ? "text-gray-300"
                            : "text-gray-700"
                        }`}>{msg.content}</p>
                        <div className={`text-[10px] mt-1 italic transition-colors duration-300 ${
                          isDarkMode
                            ? "text-gray-500"
                            : "text-gray-500"
                        }`}>in #{msg.channel.name}</div>
                     </div>
                  ))
               )}
             </>
          ) : (
             // --- CHANNEL LIST VIEW ---
             <>
               <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
                 isDarkMode
                   ? "text-gray-500"
                   : "text-gray-400"
               }`}>
                 Channels
               </div>
               {channels.map((channel) => {
                 const otherOnlineCount = channel.members.filter(m => m._id !== user?._id && onlineUsers.includes(m._id)).length;
                 
                 return (
                   <div
                     key={channel._id}
                     onClick={() => setCurrentChannel(channel)}
                     onMouseEnter={() => setHoveredChannel(channel._id)}
                     onMouseLeave={() => setHoveredChannel(null)}
                     className={`flex items-center px-3 py-2 cursor-pointer rounded-lg transition-colors group relative ${
                       currentChannel?._id === channel._id 
                         ? isDarkMode
                           ? "bg-[#f6d365] text-gray-900 font-semibold"
                           : "bg-[#fda085] text-white font-semibold"
                         : isDarkMode
                           ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                           : "text-gray-600 hover:bg-[#fda085]/10 hover:text-gray-900"
                     }`}
                   >
                     {channel.isPrivate ? (
                       <FaLock className={`mr-2 text-sm opacity-60 ${isDarkMode ? "text-[#f6d365]" : "text-[#fda085]"}`} />
                     ) : (
                       <FaComments className="mr-2 text-sm opacity-60" />
                     )}
                     <span className="truncate font-medium flex-1">{channel.name}</span>
                     
                     {hoveredChannel === channel._id && (
                       <button
                         onClick={(e) => handleSidebarDelete(e, channel)}
                         className="p-1 hover:text-red-400 transition"
                         title="Delete Channel"
                       >
                         <FaTrash size={10} />
                       </button>
                     )}

                     {hoveredChannel !== channel._id && otherOnlineCount > 0 && (
                        <div className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 min-w-[1.25rem] text-center">
                           {otherOnlineCount}
                        </div>
                     )}
                   </div>
                 );
               })}
             </>
          )}
        </div>

        <div className={`p-4 border-t flex items-center justify-between transition-colors duration-300 ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-orange-200"
        }`}>
          <div className="flex items-center flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold relative flex-shrink-0 transition-colors duration-300 ${
              isDarkMode
                ? "bg-[#f6d365] text-gray-900"
                : "bg-[#fda085] text-white"
            }`}>
              {user?.username?.charAt(0).toUpperCase()}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
            </div>
            
            <div className="ml-3 truncate flex-1">
              {isEditingName ? (
                <div className="flex items-center">
                  <input 
                    type="text" 
                    className={`w-full text-xs px-1 py-0.5 rounded outline-none border transition-colors duration-300 ${
                      isDarkMode
                        ? "bg-gray-700 text-white border-[#f6d365]"
                        : "bg-orange-50 text-gray-900 border-[#fda085]"
                    }`}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                    autoFocus
                  />
                  <FaCheck className={`ml-2 cursor-pointer transition-colors duration-300 ${
                    isDarkMode
                      ? "text-green-400 hover:text-green-300"
                      : "text-green-600 hover:text-green-700"
                  }`} onClick={saveUsername} size={12}/>
                </div>
              ) : (
                <div className={`group flex items-center cursor-pointer transition-colors duration-300 ${isDarkMode ? "hover:text-[#f6d365]" : "hover:text-[#fda085]"}`} onClick={() => setIsEditingName(true)} title="Click to edit username">
                  <p className={`text-sm font-medium truncate transition-colors duration-300 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    {user?.username}
                  </p>
                  <FaPen className={`ml-2 text-[10px] opacity-0 group-hover:opacity-100 transition ${isDarkMode ? "text-gray-500" : "text-[#fda085]"}`} />
                </div>
              )}
              <p className={`text-xs transition-colors duration-300 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className={`p-2 rounded-full transition-all duration-300 ${
                isDarkMode
                  ? "bg-[#f6d365]/20 text-[#f6d365] hover:bg-[#f6d365]/30"
                  : "bg-gray-900/20 text-gray-900 hover:bg-gray-900/30"
              }`} 
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <FaSun size={16} /> : <FaMoon size={16} />}
            </button>
            <button 
              onClick={() => {localStorage.removeItem("userInfo"); navigate("/auth")}} 
              className={`p-2 rounded-full transition-all duration-300 ${
                isDarkMode
                  ? "text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                  : "text-gray-500 hover:text-red-500 hover:bg-red-100"
              }`} 
              title="Logout"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col min-w-0 transition-colors duration-300 ${
        isDarkMode 
          ? "bg-gray-950" 
          : "bg-white"
      }`}>
        {currentChannel ? (
          <>
            <div className={`h-16 px-6 border-b flex items-center justify-between shadow-sm z-10 transition-colors duration-300 ${
              isDarkMode
                ? "bg-gray-900 border-gray-800"
                : "bg-white border-orange-200"
            }`}>
              <div className="flex items-center overflow-hidden flex-1">
                {currentChannel.isPrivate ? (
                  <FaLock className={`mr-2 flex-shrink-0 transition-colors duration-300 ${
                    isDarkMode ? "text-[#f6d365]" : "text-[#fda085]"
                  }`} />
                ) : (
                  <FaComments className={`mr-2 flex-shrink-0 transition-colors duration-300 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`} />
                )}
                <h2 
                  className={`text-lg font-bold truncate mr-4 cursor-help transition-colors duration-300 ${
                    isDarkMode 
                      ? "text-white" 
                      : "text-gray-800"
                  }`}
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
                    if (currentChannel.isPrivate && !isMember) return; 
                    setShowMembersModal(true);
                  }} 
                  className={`flex items-center text-xs bg-gray-100 px-2 py-1 rounded-md transition ${
                    currentChannel.isPrivate && !isMember 
                      ? "text-gray-400 cursor-not-allowed opacity-60" 
                      : isDarkMode
                        ? "text-gray-400 hover:text-[#f6d365] cursor-pointer"
                        : "text-gray-500 hover:text-[#fda085] cursor-pointer"
                  }`}
                >
                  <FaUsers className="mr-1" />
                  {currentChannel.members.length} members
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <button 
                    onClick={handleDeleteClick} 
                    disabled={isReadOnly}
                    className={`transition p-2 rounded-full ${isReadOnly ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}
                    title="Delete Channel"
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

            <div className={`flex-1 overflow-y-auto p-6 space-y-4 transition-colors duration-300 ${
              isDarkMode 
                ? "bg-gray-900" 
                : "bg-gray-50"
            }`} ref={chatContainerRef} onScroll={handleScroll}>
              {hasMore && messages.length > 0 && <div className="text-center text-xs text-gray-400">Loading history...</div>}
              
              {messages.map((m, i) => {
                const isMe = m.sender._id === user._id;
                const isOnline = onlineUsers.includes(m.sender._id);
                const displayName = isMe ? user.username : m.sender.username;
                const isHovered = hoveredMessage === m._id;
                const isMenuOpen = menuOpenId === m._id;
                const isEditing = editingMessageId === m._id;
                const showArrow = isMe && (isHovered || isMenuOpen) && !isEditing && !m.isDeletedForAll;
                const isDeletedMsg = m.isDeletedForAll;

                return (
                  <div 
                    key={i} 
                    className={`flex ${isMe ? "justify-end" : "justify-start"} group relative`}
                    onMouseEnter={() => setHoveredMessage(m._id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  >
                    {!isMe && (
                      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-2 mt-1 flex-shrink-0 transition-colors duration-300 ${
                        isDarkMode
                          ? "bg-[#f6d365]/20 text-[#f6d365]"
                          : "bg-orange-100 text-[#fda085]"
                      }`}>
                        {displayName.charAt(0).toUpperCase()}
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white z-10"></div>
                        )}
                      </div>
                    )}

                    <div className={`relative max-w-[75%] px-4 py-2 rounded-2xl shadow-sm transition-colors duration-300 ${
                      isMe 
                        ? isDarkMode 
                          ? "bg-[#f6d365] text-gray-900 rounded-br-none" 
                          : "bg-[#fda085] text-white rounded-br-none"
                        : isDarkMode
                          ? "bg-gray-800 text-white border border-gray-700 rounded-bl-none"
                          : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                    }`}>
                      
                      {/* DROPDOWN TRIGGER ARROW */}
                      {showArrow && (
                        <div 
                            className={`absolute top-1 right-2 cursor-pointer p-1 rounded-full ${isMe ? isDarkMode ? "hover:bg-[#f6d365]/60 text-gray-900" : "hover:bg-[#fda085]/60 text-white" : "hover:bg-gray-100 text-gray-400"}`}
                            onClick={(e) => toggleMessageMenu(e, m._id)}
                        >
                            <FaChevronDown size={10} />
                        </div>
                      )}

                      {/* DROPDOWN MENU */}
                      {isMenuOpen && (
                        <div className={`absolute top-6 right-0 shadow-xl rounded-lg py-1 z-20 w-28 animate-in fade-in zoom-in duration-100 origin-top-right transition-colors duration-300 ${
                          isDarkMode
                            ? "bg-gray-700 border border-gray-600"
                            : "bg-white border border-gray-100"
                        }`}>
                            <button 
                                onClick={() => handleEditMessage(m)} 
                                className={`w-full text-left px-3 py-2 text-xs flex items-center transition-colors duration-300 ${
                                  isDarkMode
                                    ? "text-gray-300 hover:bg-gray-600"
                                    : "text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                <FaPen className={`mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-400"}`} /> Edit
                            </button>
                            <button 
                                onClick={() => handleVerifyDelete(m._id)} 
                                className={`w-full text-left px-3 py-2 text-xs flex items-center transition-colors duration-300 ${
                                  isDarkMode
                                    ? "text-red-400 hover:bg-gray-600"
                                    : "text-red-600 hover:bg-red-50"
                                }`}
                            >
                                <FaTrash className="mr-2" /> Delete
                            </button>
                        </div>
                      )}

                      {!isMe && <p className={`text-xs font-bold mb-1 transition-colors duration-300 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{displayName}</p>}
                      
                      {isEditing ? (
                         <div className="w-full min-w-[200px]">
                            <input 
                              type="text" 
                              value={editContent} 
                              onChange={(e) => setEditContent(e.target.value)} 
                              onKeyDown={submitEditMessage}
                              className={`w-full text-sm px-2 py-1 rounded outline-none transition-colors duration-300 ${
                                isDarkMode
                                  ? "bg-gray-700 text-white"
                                  : "bg-white text-gray-900"
                              }`}
                              autoFocus
                            />
                            <div className={`text-[10px] mt-1 transition-colors duration-300 ${
                              isDarkMode
                                ? "text-[#f6d365]"
                                : "text-[#fda085]"
                            }`}>Press Enter to save, Esc to cancel</div>
                         </div>
                      ) : (
                         <div className="flex flex-wrap items-end gap-x-2 mr-2">
                            <p className={`text-sm leading-relaxed break-words ${isDeletedMsg ? "italic opacity-70 flex items-center" : ""}`}>
                                {isDeletedMsg && <FaTimes className="inline mr-1 text-xs"/>}
                                {isDeletedMsg && isMe ? "You deleted this message" : m.content}
                            </p>
                            <span className={`text-[10px] whitespace-nowrap mb-0.5 ml-auto transition-colors duration-300 ${
                              isMe 
                                ? isDarkMode ? "text-white" : "text-gray-700"
                                : isDarkMode ? "text-gray-400" : "text-gray-400"
                            }`}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                         </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {isTyping && (
                <div className="flex items-center ml-2 animate-pulse">
                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 transition-colors duration-300 ${
                     isDarkMode
                       ? "bg-gray-700 text-gray-400"
                       : "bg-gray-200 text-gray-500"
                   }`}>
                      ...
                   </div>
                   <span className={`text-xs italic transition-colors duration-300 ${
                     isDarkMode
                       ? "text-gray-400"
                       : "text-gray-500"
                   }`}>
                      {typingUser} is typing...
                   </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className={`p-4 border-t transition-colors duration-300 ${
              isDarkMode
                ? "bg-gray-900 border-gray-800"
                : "bg-white border-orange-200"
            }`}>
              {isReadOnly ? (
                <div className={`w-full py-3 font-bold rounded-xl text-center border-2 border-dashed transition-colors duration-300 ${
                  isDarkMode
                    ? "bg-gray-800 text-gray-400 border-gray-700"
                    : "bg-gray-100 text-gray-500 border-gray-300"
                }`}>
                   This channel has been deleted by the admin.
                </div>
              ) : isMember ? (
                <div className={`flex items-center rounded-xl px-4 py-2 transition-colors duration-300 ${
                  isDarkMode
                    ? "bg-gray-800"
                    : "bg-gray-100"
                }`}>
                  <input 
                    type="text" 
                    placeholder={`Message ${currentChannel.name}`} 
                    className={`flex-1 border-none focus:ring-0 focus:outline-none py-2 min-w-0 transition-colors duration-300 ${
                      isDarkMode
                        ? "bg-gray-800 text-white placeholder-gray-500"
                        : "bg-gray-100 text-gray-900 placeholder-gray-600"
                    }`}
                    value={newMessage} 
                    onChange={typingHandler} 
                    onKeyDown={sendMessage} 
                  />
                  <button 
                    onClick={(e) => sendMessage({ key: 'Enter', preventDefault: () => {} })} 
                    className={`ml-2 p-2 rounded-lg shadow-md transition-colors duration-300 ${
                      isDarkMode
                        ? "bg-[#f6d365] text-gray-900 hover:bg-[#f6d365]/80"
                        : "bg-[#fda085] text-white hover:bg-[#fda085]/80"
                    }`}
                  >
                    <FaPaperPlane />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                   <button 
                     onClick={handleJoinClick} 
                     className={`w-full py-3 font-bold rounded-xl shadow-lg transition transform hover:scale-[1.01] flex items-center justify-center ${
                       isDarkMode
                         ? "bg-[#f6d365] text-gray-900 hover:bg-[#f6d365]/80"
                         : "bg-[#fda085] text-white hover:bg-[#fda085]/80"
                     }`}
                   >
                    {currentChannel.isPrivate && <FaLock className="mr-2" />}
                    {currentChannel.isPrivate ? "Join Private Channel" : `Join ${currentChannel.name}`}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center text-center p-8 transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-900"
              : "bg-gray-50"
          }`}>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${
              isDarkMode
                ? "bg-[#f6d365]/20"
                : "bg-orange-100"
            }`}>
               <FaUserCircle className={`text-5xl transition-colors duration-300 ${
                 isDarkMode
                   ? "text-[#f6d365]"
                   : "text-[#fda085]"
               }`} />
            </div>
            <h2 className={`text-3xl font-bold mb-2 transition-colors duration-300 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Welcome to ChatFlow</h2>
            <p className={`transition-colors duration-300 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Select a channel or create one to begin.</p>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {/* ... (Tooltip, Members, Create, Join, Leave, DeleteChannel modals remain same as before) ... */}

      {/* --- DELETE MESSAGE MODAL --- */}
      {showMsgDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <FaTrash className="text-2xl text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Message?</h3>
              <p className="text-gray-500 mb-6 text-sm">How would you like to delete this message?</p>
              
              <div className="flex flex-col space-y-3">
                 <button 
                    onClick={() => confirmDeleteMessage("everyone")} 
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm font-medium"
                 >
                    Delete for everyone
                 </button>
                 <button 
                    onClick={() => confirmDeleteMessage("me")} 
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition shadow-sm font-medium"
                 >
                    Delete for me
                 </button>
                 <button 
                    onClick={() => setShowMsgDeleteModal(false)} 
                    className="w-full py-2 border border-gray-300 rounded-lg text-gray-500 hover:text-gray-700 transition"
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* ... (Existing Tooltip, Members, Create, Join, Leave, Delete Channel modals copied for completeness) ... */}
       {tooltip.visible && (
        <div className="fixed z-50 bg-gray-800 text-white text-xs px-3 py-2 rounded-md shadow-xl border border-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.text}</div>
      )}
      {showMembersModal && currentChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className={`rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100 transition-colors duration-300 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className={`p-4 border-b flex justify-between items-center transition-colors duration-300 ${
              isDarkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"
            }`}>
              <h3 className={`font-bold transition-colors duration-300 ${
                isDarkMode ? "text-white" : "text-gray-700"
              }`}>Members of {currentChannel.name}</h3>
              <button onClick={() => setShowMembersModal(false)} className={`transition-colors duration-300 ${
                isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"
              }`}>
                <IoMdClose size={24} />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {currentChannel.members.map(member => (
                <div key={member._id} className={`flex items-center py-2 border-b last:border-0 transition-colors duration-300 ${
                  isDarkMode ? "border-gray-700" : "border-gray-100"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-3 transition-colors duration-300 ${
                    isDarkMode ? "bg-[#f6d365]/20 text-[#f6d365]" : "bg-orange-100 text-[#fda085]"
                  }`}>
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <span className={`font-medium transition-colors duration-300 ${
                    isDarkMode ? "text-white" : "text-gray-700"
                  }`}>{member.username}</span>
                  {currentChannel.admin === member._id && (
                    <span className={`ml-2 text-[10px] border px-2 py-0.5 rounded-full font-bold uppercase flex items-center transition-colors duration-300 ${
                      isDarkMode ? "bg-[#f6d365]/20 text-[#f6d365] border-[#f6d365]/30" : "bg-orange-100 text-[#fda085] border-orange-200"
                    }`}>
                      <FaCrown className="mr-1 text-[9px]"/> Admin
                    </span>
                  )}
                  {member._id === user._id && (
                    <span className={`ml-auto text-xs px-2 py-1 rounded transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400 bg-gray-700" : "text-gray-400 bg-gray-100"
                    }`}>You</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className={`rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-6 transition-colors duration-300 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold transition-colors duration-300 ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>Create Channel</h2>
              <button onClick={() => setShowCreateModal(false)} className={`transition-colors duration-300 ${
                isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"
              }`}>
                <IoMdClose size={24} />
              </button>
            </div>
            <form onSubmit={submitCreateChannel} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>Channel Name</label>
                <div className={`flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 transition-colors duration-300 ${
                  isDarkMode 
                    ? "border-gray-600 focus-within:ring-[#f6d365]/30 bg-gray-700" 
                    : "border-gray-300 focus-within:ring-[#fda085]/30 bg-white"
                }`}>
                  <FaComments className={`mr-2 transition-colors duration-300 ${
                    isDarkMode ? "text-gray-400" : "text-gray-400"
                  }`} />
                  <input 
                    type="text" 
                    className={`flex-1 outline-none transition-colors duration-300 ${
                      isDarkMode ? "bg-gray-700 text-white placeholder-gray-400" : "bg-white text-gray-700 placeholder-gray-400"
                    }`} 
                    placeholder="general" 
                    value={createData.name} 
                    onChange={(e) => setCreateData({...createData, name: e.target.value})} 
                    required 
                    autoFocus 
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>Description (Optional)</label>
                <textarea 
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 outline-none text-sm transition-colors duration-300 ${
                    isDarkMode 
                      ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-[#f6d365]/30" 
                      : "border-gray-300 bg-white text-gray-700 placeholder-gray-400 focus:ring-[#fda085]/30"
                  }`} 
                  rows="2" 
                  placeholder="What is this channel about?" 
                  value={createData.description} 
                  onChange={(e) => setCreateData({...createData, description: e.target.value})}
                />
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-300 ${
                isDarkMode ? "bg-gray-700" : "bg-gray-50"
              }`}>
                <div className="flex items-center">
                  {createData.isPrivate ? (
                    <FaLock className={`mr-2 transition-colors duration-300 ${
                      isDarkMode ? "text-[#f6d365]" : "text-[#fda085]"
                    }`} />
                  ) : (
                    <FaUnlock className={`mr-2 transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400" : "text-gray-400"
                    }`} />
                  )}
                  <span className={`font-medium transition-colors duration-300 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>Private Channel</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={createData.isPrivate} 
                    onChange={(e) => setCreateData({...createData, isPrivate: e.target.checked})} 
                  />
                  <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all transition-colors duration-300 ${
                    isDarkMode 
                      ? "bg-gray-600 peer-focus:ring-[#f6d365]/30 after:border-gray-500 peer-checked:bg-[#f6d365]" 
                      : "bg-gray-200 peer-focus:ring-[#fda085]/30 after:border-gray-300 peer-checked:bg-[#fda085]"
                  }`} />
                </label>
              </div>
              {createData.isPrivate && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>Password</label>
                  <input 
                    type="password" 
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 outline-none transition-colors duration-300 ${
                      isDarkMode 
                        ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-[#f6d365]/30" 
                        : "border-gray-300 bg-white text-gray-700 placeholder-gray-400 focus:ring-[#fda085]/30"
                    }`} 
                    placeholder="••••••••" 
                    value={createData.password} 
                    onChange={(e) => setCreateData({...createData, password: e.target.value})} 
                    required 
                  />
                </div>
              )}
              <button 
                type="submit" 
                className={`w-full font-bold py-3 rounded-lg shadow-md transition-colors duration-300 mt-2 ${
                  isDarkMode 
                    ? "bg-[#f6d365] hover:bg-[#f6d365]/80 text-gray-900" 
                    : "bg-[#fda085] hover:bg-[#fda085]/80 text-white"
                }`}
              >
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className={`rounded-xl shadow-2xl w-full max-w-sm p-6 text-center transition-colors duration-300 ${
             isDarkMode ? "bg-gray-800" : "bg-white"
           }`}>
             <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors duration-300 ${
               isDarkMode ? "bg-[#f6d365]/20" : "bg-orange-100"
             }`}>
               <FaLock className={`text-2xl transition-colors duration-300 ${
                 isDarkMode ? "text-[#f6d365]" : "text-[#fda085]"
               }`} />
             </div>
             <h3 className={`text-xl font-bold mb-2 transition-colors duration-300 ${
               isDarkMode ? "text-white" : "text-gray-800"
             }`}>Private Channel</h3>
             <p className={`mb-6 text-sm transition-colors duration-300 ${
               isDarkMode ? "text-gray-400" : "text-gray-500"
             }`}>
               Enter the password to join <span className={`font-bold ${
                 isDarkMode ? "text-white" : "text-gray-800"
               }`}>{currentChannel?.name}</span>
             </p>
             <div className="relative mb-4">
               <input 
                 type={showPassword ? "text" : "password"} 
                 className={`w-full border rounded-lg px-4 py-2 pr-10 focus:ring-2 outline-none text-center transition-colors duration-300 ${
                   isDarkMode 
                     ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-[#f6d365]/30" 
                     : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-[#fda085]/30"
                 }`} 
                 placeholder="Enter Password" 
                 value={joinPassword} 
                 onChange={(e) => setJoinPassword(e.target.value)} 
                 autoFocus 
                 onKeyDown={(e) => e.key === 'Enter' && submitJoinChannel(joinPassword)} 
               />
               <button 
                 onClick={() => setShowPassword(!showPassword)} 
                 className={`absolute right-3 top-3 focus:outline-none transition-colors duration-300 ${
                   isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"
                 }`} 
                 type="button"
               >
                 {showPassword ? <FaEyeSlash /> : <FaEye />}
               </button>
             </div>
             <div className="flex space-x-3">
               <button 
                 onClick={() => setShowJoinModal(false)} 
                 className={`flex-1 py-2 border rounded-lg transition-colors duration-300 ${
                   isDarkMode 
                     ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                     : "border-gray-300 text-gray-700 hover:bg-gray-50"
                 }`}
               >
                 Cancel
               </button>
               <button 
                 onClick={() => submitJoinChannel(joinPassword)} 
                 className={`flex-1 py-2 rounded-lg transition-colors duration-300 shadow-sm ${
                   isDarkMode 
                     ? "bg-[#f6d365] hover:bg-[#f6d365]/80 text-gray-900" 
                     : "bg-[#fda085] hover:bg-[#fda085]/80 text-white"
                 }`}
               >
                 Join
               </button>
             </div>
           </div>
        </div>
      )}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className={`rounded-xl shadow-2xl w-full max-w-sm p-6 text-center transition-colors duration-300 ${
             isDarkMode ? "bg-gray-800" : "bg-white"
           }`}>
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
               {isSidebarDeleteAction ? (
                 <FaTrash className="text-2xl text-red-600" />
               ) : (
                 <FaSignOutAlt className="text-2xl text-red-500" />
               )}
             </div>
             <h3 className={`text-xl font-bold mb-2 transition-colors duration-300 ${
               isDarkMode ? "text-white" : "text-gray-800"
             }`}>
               {isSidebarDeleteAction ? "Delete Channel?" : "Leave Channel?"}
             </h3>
             <p className={`mb-6 text-sm transition-colors duration-300 ${
               isDarkMode ? "text-gray-400" : "text-gray-500"
             }`}>
               Are you sure you want to leave <span className={`font-bold ${
                 isDarkMode ? "text-white" : "text-gray-800"
               }`}>{currentChannel?.name}</span>{isSidebarDeleteAction ? " before deleting?" : "?"}
             </p>
             <div className="flex space-x-3">
               <button 
                 onClick={() => setShowLeaveModal(false)} 
                 className={`flex-1 py-2 border rounded-lg transition-colors duration-300 ${
                   isDarkMode 
                     ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                     : "border-gray-300 text-gray-700 hover:bg-gray-50"
                 }`}
               >
                 Cancel
               </button>
               <button 
                 onClick={submitLeaveChannel} 
                 className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm"
               >
                 {isSidebarDeleteAction ? "Delete" : "Leave"}
               </button>
             </div>
           </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className={`rounded-xl shadow-2xl w-full max-w-sm p-6 text-center transition-colors duration-300 ${
             isDarkMode ? "bg-gray-800" : "bg-white"
           }`}>
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <FaTrash className="text-2xl text-red-600" />
             </div>
             <h3 className={`text-xl font-bold mb-2 transition-colors duration-300 ${
               isDarkMode ? "text-white" : "text-gray-800"
             }`}>Delete Channel?</h3>
             <p className={`mb-4 text-sm transition-colors duration-300 ${
               isDarkMode ? "text-gray-400" : "text-gray-500"
             }`}>
               This will delete the channel for everyone. <br/>
               <span className="text-xs text-red-500">(Users can read history but not send)</span>
             </p>
             <div className="flex space-x-3">
               <button 
                 onClick={() => setShowDeleteModal(false)} 
                 className={`flex-1 py-2 border rounded-lg transition-colors duration-300 ${
                   isDarkMode 
                     ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                     : "border-gray-300 text-gray-700 hover:bg-gray-50"
                 }`}
               >
                 Cancel
               </button>
               <button 
                 onClick={submitDeleteChannel} 
                 className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm"
               >
                 Delete
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Chat;