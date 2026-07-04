"""cell-annotato API — 单细胞分类平台"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import datasets_cache
from app.h5ad_service import run_mock_scbert

app = FastAPI(
    title="cell-annotato",
    description="单细胞分类平台 API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/upload")
async def upload_h5ad(file: UploadFile = File(...)):
    """上传 .h5ad 文件，触发 mock scBERT 推理。"""
    if not file.filename or not file.filename.endswith(".h5ad"):
        raise HTTPException(400, "仅支持 .h5ad 文件")

    try:
        result = run_mock_scbert(file.filename)
    except FileNotFoundError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"文件解析失败: {e}")

    return {
        "dataset_id": result["dataset_id"],
        "name": result["name"],
        "cell_count": result["cell_count"],
        "cell_types": result["cell_types"],
    }


@app.get("/api/datasets/{dataset_id}")
async def get_dataset(dataset_id: str):
    """获取数据集概要信息（细胞类型、数量等）。"""
    ds = datasets_cache.get(dataset_id)
    if ds is None:
        raise HTTPException(404, "数据集不存在，请重新上传")

    return {
        "dataset_id": ds["dataset_id"],
        "name": ds["name"],
        "cell_count": ds["cell_count"],
        "cell_types": ds["cell_types"],
    }


@app.get("/api/datasets/{dataset_id}/cells")
async def get_cells(dataset_id: str):
    """获取数据集的所有细胞数据，供散点图渲染。

    返回 ~17,000 条记录，每条包含坐标、标签、置信度等字段。
    """
    ds = datasets_cache.get(dataset_id)
    if ds is None:
        raise HTTPException(404, "数据集不存在，请重新上传")

    return {
        "dataset_id": ds["dataset_id"],
        "name": ds["name"],
        "cell_count": ds["cell_count"],
        "cell_types": ds["cell_types"],
        "cells": ds["cells"],
    }
