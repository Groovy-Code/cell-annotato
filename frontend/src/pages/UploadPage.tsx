import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../api";

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<
    "idle" | "uploading" | "inferring" | "done"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".h5ad")) {
      setFile(f);
      setError("");
    } else {
      setError("仅支持 .h5ad 格式文件");
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

    setStage("uploading");
    try {
      const result = await uploadFile(file, setProgress);
      setStage("inferring");
      await new Promise((r) => setTimeout(r, 800));
      setStage("done");
      navigate(`/result/${result.dataset_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "上传失败");
      setStage("idle");
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <main className="upload-main">
        <div className="brand">
          <h1>cell-annotato</h1>
          <p>单细胞分类平台</p>
        </div>

        <div
          className={`drop-zone ${file ? "has-file" : ""} ${uploading ? "uploading" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInput.current?.click()}
        >
          {!file ? (
            <div className="drop-prompt">
              <svg
                className="drop-svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <h2>拖拽 .h5ad 文件到此处</h2>
              <p>或点击选择文件</p>
            </div>
          ) : (
            <div className="drop-file">
              <div className="file-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h2>{file.name}</h2>
              <p className="file-size">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              {!uploading && (
                <button
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                >
                  开始上传
                </button>
              )}
            </div>
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
            <div className="progress-track">
              <div
                className={`progress-fill ${stage === "inferring" ? "indeterminate" : ""}`}
                style={{
                  width:
                    stage === "uploading"
                      ? `${progress}%`
                      : stage === "inferring"
                        ? "100%"
                        : "0%",
                }}
              />
            </div>
            <p className="progress-label">
              {stage === "uploading"
                ? `上传中 ${progress}%`
                : "scBERT 模型推理中…"}
            </p>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => { setError(""); setFile(null); }}>
              重试
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
