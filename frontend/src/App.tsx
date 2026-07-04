import { BrowserRouter, Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import ResultPage from "./pages/ResultPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/result/:id" element={<ResultPage />} />
      </Routes>
    </BrowserRouter>
  );
}
