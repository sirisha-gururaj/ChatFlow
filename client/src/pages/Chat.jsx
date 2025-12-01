import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Chat = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState();

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    setUser(userInfo);

    if (!userInfo) {
      navigate("/auth");
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-indigo-50">
      <div className="text-center p-10 bg-white rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to ChatFlow</h1>
        <p className="text-gray-600 mb-6">Hello, {user?.username}!</p>
        <button
          onClick={() => {
            localStorage.removeItem("userInfo");
            navigate("/auth");
          }}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Chat;