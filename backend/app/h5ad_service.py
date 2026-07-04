"""h5ad 文件解析 & Mock scBERT 推理服务"""

import uuid
from pathlib import Path

import h5py
import numpy as np

from app.config import PAIRED_H5AD_DIR, datasets_cache

# 10 种细胞类型的固定配色（ECharts 调色板）
TYPE_COLORS = [
    "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
    "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#48b8d0",
]


def _extract_first_level(label: str) -> str:
    """从层级标签中提取第一级分类名。

    例: "Monocytes / Monocyte-derived cells/Macrophages" → "Monocytes"
    """
    if not isinstance(label, str):
        return str(label)
    return label.split(" / ")[0].strip()


def _read_obs_column(obs_group: h5py.Group, col_name: str) -> np.ndarray:
    """读取 obs 中的一列数据，自动处理 categorical 和数值类型。

    - categorical 列: Group 包含 'categories' 和 'codes'，用 codes 索引 categories 解码
    - 数值列: Dataset，直接读取
    """
    item = obs_group[col_name]
    if isinstance(item, h5py.Group):
        # categorical: codes (int index) → categories (str values)
        codes = item["codes"][:]
        categories = item["categories"][:].astype(str)
        return categories[codes]
    else:
        return item[:]


def parse_h5ad(file_path: Path) -> dict:
    """解析 h5ad 文件，提取可视化所需数据。使用 h5py 避免文件锁定。

    Returns:
        {
            "dataset_id": str (UUID),
            "name": str,
            "cell_count": int,
            "cell_types": [{"name": str, "count": int, "color": str}, ...],
            "cells": [{"cell_id": int, "x": float, "y": float,
                       "label": str, "full_label": str, "prob": float,
                       "top2_label": str, "top2_prob": float, "margin": float}, ...]
        }
    """
    with h5py.File(file_path, "r") as f:
        obs = f["obs"]

        # 读取核心列
        cell_ids = _read_obs_column(obs, "cell").astype(int)
        predict_labels = _read_obs_column(obs, "scbert_predict")
        top1_probs = _read_obs_column(obs, "scbert_predict_top1_prob")
        top2_labels = _read_obs_column(obs, "scbert_predict_top2_label")
        top2_probs = _read_obs_column(obs, "scbert_predict_top2_prob")
        margins = _read_obs_column(obs, "scbert_predict_margin")

        # 空间坐标
        coords = f["obsm"]["spatial"][:]  # shape: (n_cells, 2)

    n_cells = len(cell_ids)

    # 细胞类型统计（按第一级分类计数）
    first_levels = [_extract_first_level(str(l)) for l in predict_labels]
    from collections import Counter
    type_counts = Counter(first_levels)

    # 按数量降序排列，给每种类型分配颜色
    sorted_types = sorted(type_counts.items(), key=lambda x: -x[1])
    cell_types = []
    for i, (tname, tcount) in enumerate(sorted_types):
        cell_types.append({
            "name": tname,
            "count": tcount,
            "color": TYPE_COLORS[i % len(TYPE_COLORS)],
        })

    # 构建细胞列表
    cells = []
    for i in range(n_cells):
        cells.append({
            "cell_id": int(cell_ids[i]),
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1]),
            "label": first_levels[i],
            "full_label": str(predict_labels[i]),
            "prob": round(float(top1_probs[i]), 4),
            "top2_label": str(top2_labels[i]),
            "top2_prob": round(float(top2_probs[i]), 4),
            "margin": round(float(margins[i]), 4),
        })

    dataset_id = str(uuid.uuid4())
    name = file_path.stem

    result = {
        "dataset_id": dataset_id,
        "name": name,
        "cell_count": n_cells,
        "cell_types": cell_types,
        "cells": cells,
    }

    return result


def run_mock_scbert(original_filename: str) -> dict:
    """Mock scBERT 推理：根据上传文件名查找配对的输出 h5ad。

    命名约定：
        输入: xxx.h5ad  →  输出: xxx_predict.h5ad
    """
    stem = Path(original_filename).stem
    paired_name = f"{stem}_predict.h5ad"
    paired_path = PAIRED_H5AD_DIR / paired_name

    if not paired_path.exists():
        raise FileNotFoundError(
            f"未找到配对的预测文件: {paired_path}\n"
            f"请确认 '{PAIRED_H5AD_DIR}' 目录下存在 '{paired_name}'"
        )

    # 解析配对文件
    result = parse_h5ad(paired_path)

    # 存入内存缓存
    datasets_cache[result["dataset_id"]] = result

    return result
