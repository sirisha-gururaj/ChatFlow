import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true); // Toggle state
  const [username, setUsername] = useState(""); // Ensure empty
  const [email, setEmail] = useState("");       // Ensure empty
  const [password, setPassword] = useState(""); // Ensure empty
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // API Endpoint based on toggle state
    const endpoint = isLogin
      ? "http://localhost:5000/api/user/login"
      : "http://localhost:5000/api/user";

    const payload = isLogin ? { email, password } : { username, email, password };

    try {
      const { data } = await axios.post(endpoint, payload);
      
      // Save User Data to LocalStorage
      localStorage.setItem("userInfo", JSON.stringify(data));
      
      setLoading(false);
      navigate("/chat"); // Redirect to Chat Page
    } catch (error) {
      setLoading(false);
      // specific error message or fallback
      const errorMsg = error.response?.data?.message || "An error occurred";
      alert(errorMsg);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundImage: "linear-gradient(120deg, #f6d365 0%, #fda085 100%)" }}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent tracking-tighter mb-2">
            ChatFlow
          </h1>
          <p className="text-gray-600 text-sm">
            {isLogin ? "Welcome back! Please login." : "Create an account to join."}
          </p>
        </div>

        {/* Toggle Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              isLogin ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              !isLogin ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                placeholder="johndoe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="name@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;