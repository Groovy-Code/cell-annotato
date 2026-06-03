import { useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

function App() {
  const [backendStatus, setBackendStatus] = useState<string>("未检测");

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setBackendStatus(`✅ 后端连接成功 — ${data.status} v${data.version}`);
    } catch {
      setBackendStatus("❌ 后端未启动");
    }
  };

  return (
    <div className="app">
      <h1>🔬 cell-annotato</h1>
      <p className="subtitle">细胞图像标注平台 MVP</p>
      <div className="card">
        <button onClick={checkBackend}>检测后端连接</button>
        <p className="status">{backendStatus}</p>
      </div>
    </div>
  );
}

export default App;
