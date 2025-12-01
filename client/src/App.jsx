import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/chat" element={<Chat />} />
        {/* Default redirect to Auth */}
        <Route path="/" element={<Navigate to="/auth" />} />
      </Routes>
    </div>
  );
}

export default App;