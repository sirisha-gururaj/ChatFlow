import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { FaPlus, FaHashtag, FaSignOutAlt, FaPaperPlane, FaUserCircle } from "react-icons/fa";

// Connect to the backend Socket
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
  
  // Ref for auto-scrolling to bottom of chat
  const messagesEndRef = useRef(null);

  // 1. Initial Load: Check Auth & Setup Socket
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    setUser(userInfo);

    if (!userInfo) navigate("/auth");

    // Initialize Socket
    socket = io(ENDPOINT);
    socket.emit("setup", userInfo);
    socket.on("connected", () => setSocketConnected(true));

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  // 2. Fetch Channels
  useEffect(() => {
    const fetchChannels = async () => {
      if (!user) return;
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get("http://localhost:5000/api/chat/channels", config);
        setChannels(data);
      } catch (error) {
        console.error("Failed to load channels");
      }
    };
    fetchChannels();
  }, [user]);

  // 3. Fetch Messages when Channel Selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentChannel) return;
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get(
          `http://localhost:5000/api/chat/message/${currentChannel._id}`,
          config
        );
        setMessages(data);
        socket.emit("join chat", currentChannel._id);
        selectedChatCompare = currentChannel;
      } catch (error) {
        console.error("Failed to load messages");
      }
    };
    fetchMessages();
  }, [currentChannel, user]);

  // 4. Real-time Message Listener
  useEffect(() => {
    socket.on("message received", (newMessageReceived) => {
      if (
        !selectedChatCompare ||
        selectedChatCompare._id !== newMessageReceived.channel._id
      ) {
        // Notification logic could go here
      } else {
        setMessages([...messages, newMessageReceived]);
      }
    });
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handler: Send Message
  const sendMessage = async (e) => {
    if (e.key === "Enter" && newMessage) {
      e.preventDefault();
      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        setNewMessage(""); // Clear input immediately
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

  // Handler: Create Channel
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

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* --- SIDEBAR --- */}
      <div className="w-1/4 bg-gray-900 text-white flex flex-col border-r border-gray-800">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h1 className="text-xl font-bold tracking-wider text-indigo-400">ChatFlow</h1>
          <button onClick={createChannel} className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white">
            <FaPlus />
          </button>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Channels
          </div>
          {channels.map((channel) => (
            <div
              key={channel._id}
              onClick={() => setCurrentChannel(channel)}
              className={`flex items-center px-3 py-2 cursor-pointer rounded-lg transition-colors ${
                currentChannel?._id === channel._id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <FaHashtag className="mr-2 text-sm opacity-60" />
              <span className="truncate font-medium">{channel.name}</span>
            </div>
          ))}
        </div>

        {/* User Profile / Logout */}
        <div className="p-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.username}</p>
              <p className="text-xs text-gray-400">Online</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition">
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 flex flex-col bg-white">
        {currentChannel ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 border-b flex items-center justify-between bg-white shadow-sm z-10">
              <div className="flex items-center">
                <FaHashtag className="text-gray-400 mr-2" />
                <h2 className="text-lg font-bold text-gray-800">{currentChannel.name}</h2>
              </div>
              <div className="text-sm text-gray-500">
                {currentChannel.members.length} members
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
              {messages.map((m, i) => {
                const isMe = m.sender._id === user._id;
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 mt-1">
                        <span className="text-xs font-bold text-indigo-600">
                          {m.sender.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-sm ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                      }`}
                    >
                      {!isMe && (
                        <p className="text-xs text-gray-400 font-medium mb-1">{m.sender.username}</p>
                      )}
                      <p className="text-sm leading-relaxed">{m.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2">
                <input
                  type="text"
                  placeholder={`Message #${currentChannel.name}`}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 py-2"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={sendMessage}
                />
                <button 
                  onClick={(e) => sendMessage({ key: 'Enter', preventDefault: () => {} })}
                  className="ml-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md hover:shadow-lg"
                >
                  <FaPaperPlane className="text-sm" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Welcome State (No Channel Selected) */
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center p-8">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
               <FaUserCircle className="text-5xl text-indigo-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to ChatFlow</h2>
            <p className="text-gray-500 max-w-md">
              Select a channel from the sidebar to start chatting or create a new one to invite your friends!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;