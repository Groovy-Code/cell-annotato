import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../api";

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "inferring" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".h5ad")) {
      setFile(f);
      setError("");
    } else {
      setError("仅支持 .h5ad 文件");
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    // 阶段 1：上传文件
    setStage("uploading");
    try {
      const result = await uploadFile(file, setProgress);
      // 阶段 2：模型推理中（mock 是瞬间完成，加点延迟让用户感知）
      setStage("inferring");
      await new Promise((r) => setTimeout(r, 800));
      setStage("done");
      navigate(`/result/${result.dataset_id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "上传失败";
      setError(msg);
      setStage("idle");
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <header className="upload-header">
        <h1>🔬 cell-annotato</h1>
        <p>单细胞分类平台 · 上传数据 · 可视化 · 专家纠偏</p>
      </header>

      <main className="upload-main">
        <div
          className={`drop-zone ${file ? "has-file" : ""} ${uploading ? "uploading" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInput.current?.click()}
        >
          {!file ? (
            <>
              <div className="drop-icon">📁</div>
              <h2>拖拽 .h5ad 文件到此处</h2>
              <p>或点击选择文件</p>
            </>
          ) : (
            <>
              <div className="drop-icon">📄</div>
              <h2>{file.name}</h2>
              <p>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              {!uploading && (
                <button className="btn-upload" onClick={(e) => { e.stopPropagation(); handleUpload(); }}>
                  开始上传
                </button>
              )}
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".h5ad"
            onChange={handleSelect}
            style={{ display: "none" }}
          />
        </div>

        {uploading && (
          <div className="progress-section">
            <div className="progress-bar">
              <div
                className={`progress-fill ${stage === "inferring" ? "inferring" : ""}`}
                style={{
                  width: stage === "uploading" ? `${progress}%` : stage === "inferring" ? "100%" : "0%",
                }}
              />
            </div>
            <p className="progress-text">
              {stage === "uploading"
                ? `上传中... ${progress}%`
                : "模型推理中..."}
            </p>
          </div>
        )}

        {error && <div className="error-msg">❌ {error}</div>}
      </main>
    </div>
  );
}
