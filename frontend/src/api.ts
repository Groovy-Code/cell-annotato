const API = "/api";

export interface CellType {
  name: string;
  count: number;
  color: string;
}

export interface Cell {
  cell_id: number;
  x: number;
  y: number;
  umap_x?: number;
  umap_y?: number;
  label: string;
  full_label: string;
  prob: number;
  top2_label: string;
  top2_prob: number;
  margin: number;
}

export interface UploadResponse {
  dataset_id: string;
  name: string;
  cell_count: number;
  cell_types: CellType[];
}

export interface DatasetResponse {
  dataset_id: string;
  name: string;
  cell_count: number;
  cell_types: CellType[];
}

export interface CellsResponse {
  dataset_id: string;
  name: string;
  cell_count: number;
  cell_types: CellType[];
  cells: Cell[];
}

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const detail = JSON.parse(xhr.responseText).detail || xhr.statusText;
        reject(new Error(detail));
      }
    };

    xhr.onerror = () => reject(new Error("网络连接失败"));
    xhr.send(formData);
  });
}

export async function fetchDataset(id: string): Promise<DatasetResponse> {
  const r = await fetch(`${API}/datasets/${id}`);
  if (!r.ok) throw new Error((await r.json()).detail || "加载失败");
  return r.json();
}

export async function fetchCells(id: string): Promise<CellsResponse> {
  const r = await fetch(`${API}/datasets/${id}/cells`);
  if (!r.ok) throw new Error((await r.json()).detail || "加载失败");
  return r.json();
}
