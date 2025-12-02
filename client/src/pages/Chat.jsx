import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  FaPlus, FaHashtag, FaSignOutAlt, FaPaperPlane, 
  FaUserCircle, FaUsers, FaDoorOpen 
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
  
  // Typing & Pagination
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // --- INITIAL SETUP ---
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    setUser(userInfo);
    if (!userInfo) navigate("/auth");

    socket = io(ENDPOINT);
    socket.emit("setup", userInfo);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("online users", (users) => setOnlineUsers(users));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  // --- FETCH DATA ---
  const refreshChannels = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("http://localhost:5000/api/chat/channels", config);
      setChannels(data);
      // If we are currently in a channel, update its data (to reflect member changes)
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

  // --- LOAD MESSAGES ---
  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentChannel) return;
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get(
          `http://localhost:5000/api/chat/message/${currentChannel._id}?page=1`,
          config
        );
        
        setMessages(data);
        setPage(1);
        setHasMore(data.length === 20);
        
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

  // Join Channel
  const handleJoin = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(
        "http://localhost:5000/api/chat/channel/join",
        { channelId: currentChannel._id },
        config
      );
      alert(`Joined #${currentChannel.name}`);
      refreshChannels();
    } catch (error) {
      alert("Error joining channel");
    }
  };

  // Leave Channel
  const handleLeave = async () => {
    if(!window.confirm(`Are you sure you want to leave #${currentChannel.name}?`)) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(
        "http://localhost:5000/api/chat/channel/leave",
        { channelId: currentChannel._id },
        config
      );
      refreshChannels();
      setCurrentChannel(null); // Go back to welcome screen
    } catch (error) {
      alert("Error leaving channel");
    }
  };

  // Send Message
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
      }
    }
  };

  // Create Channel
  const createChannel = async () => {
    const channelName = prompt("Enter new channel name:");
    if (!channelName) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(
        "http://localhost:5000/api/chat/channel",
        { name: channelName },
        config
      );
      setChannels([...channels, data]);
    } catch (error) {
      alert("Failed to create channel");
    }
  };

  // Pagination Scroll
  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore) {
      // Logic to load more (simplified for brevity)
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
      if (data.length > 0) {
        setMessages(prev => [...data, ...prev]);
        setPage(nextPage);
        setHasMore(data.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (error) { console.error("Error loading more"); }
  };

  // Socket Listener
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

  // Check if I am a member
  const isMember = currentChannel?.members.some(m => m._id === user?._id);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white flex flex-col border-r border-gray-800 flex-shrink-0">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h1 className="text-xl font-bold tracking-wider text-indigo-400">ChatFlow</h1>
          <button onClick={createChannel} className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white" title="Create Channel">
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
              className={`flex items-center px-3 py-2 cursor-pointer rounded-lg transition-colors group ${
                currentChannel?._id === channel._id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <FaHashtag className="mr-2 text-sm opacity-60" />
              <span className="truncate font-medium flex-1">{channel.name}</span>
              {/* Optional: Show check if joined */}
              {channel.members.some(m => m._id === user?._id) && (
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 ml-2"></div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold relative">
              {user?.username?.charAt(0).toUpperCase()}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
            </div>
            <div className="ml-3 truncate max-w-[100px]">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-gray-400">Online</p>
            </div>
          </div>
          <button onClick={() => {localStorage.removeItem("userInfo"); navigate("/auth")}} className="text-gray-400 hover:text-red-400 transition" title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {currentChannel ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 border-b flex items-center justify-between bg-white shadow-sm z-10">
              <div className="flex items-center overflow-hidden">
                <FaHashtag className="text-gray-400 mr-2 flex-shrink-0" />
                <h2 className="text-lg font-bold text-gray-800 truncate mr-4">{currentChannel.name}</h2>
                <button 
                  onClick={() => setShowMembersModal(true)}
                  className="flex items-center text-xs text-gray-500 hover:text-indigo-600 bg-gray-100 px-2 py-1 rounded-md transition"
                >
                  <FaUsers className="mr-1" />
                  {currentChannel.members.length} members
                </button>
              </div>
              
              {isMember && (
                <button 
                  onClick={handleLeave}
                  className="text-gray-400 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50"
                  title="Leave Channel"
                >
                  <FaDoorOpen />
                </button>
              )}
            </div>

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4"
              ref={chatContainerRef}
              onScroll={handleScroll}
            >
              {hasMore && messages.length > 0 && <div className="text-center text-xs text-gray-400">Loading history...</div>}
              
              {messages.map((m, i) => {
                const isMe = m.sender._id === user._id;
                const isOnline = onlineUsers.includes(m.sender._id);
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <div className="relative mr-2 mt-1">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {m.sender.username.charAt(0).toUpperCase()}
                        </div>
                        {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-50"></div>}
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"}`}>
                      {!isMe && <p className="text-xs text-gray-400 font-bold mb-1">{m.sender.username}</p>}
                      <p className="text-sm leading-relaxed break-words">{m.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {isTyping && <div className="text-xs text-gray-500 italic ml-2">Someone is typing...</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input / Join Action */}
            <div className="p-4 bg-white border-t border-gray-100">
              {isMember ? (
                <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2">
                  <input
                    type="text"
                    placeholder={`Message #${currentChannel.name}`}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 py-2 min-w-0"
                    value={newMessage}
                    onChange={typingHandler}
                    onKeyDown={sendMessage}
                  />
                  <button 
                    onClick={(e) => sendMessage({ key: 'Enter', preventDefault: () => {} })}
                    className="ml-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md"
                  >
                    <FaPaperPlane />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleJoin}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-[1.01]"
                >
                  Join #{currentChannel.name} to start chatting
                </button>
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

      {/* MEMBER LIST MODAL */}
      {showMembersModal && currentChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-700">Members of #{currentChannel.name}</h3>
              <button onClick={() => setShowMembersModal(false)} className="text-gray-400 hover:text-gray-600">
                <IoMdClose size={24} />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {currentChannel.members.map(member => (
                <div key={member._id} className="flex items-center py-2 border-b border-gray-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-700 font-medium">{member.username}</span>
                  {member._id === user._id && <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">You</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;