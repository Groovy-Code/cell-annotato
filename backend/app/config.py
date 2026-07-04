"""应用配置"""

import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 上传文件存储目录
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# 配对的预测结果 h5ad 文件存放目录（mock scBERT 会在此目录查找）
# 可通过环境变量 PAIRED_H5AD_DIR 覆盖
PAIRED_H5AD_DIR = Path(os.getenv("PAIRED_H5AD_DIR", r"D:\work"))

# 内存缓存：key = dataset_id (UUID), value = 解析后的数据集
datasets_cache: dict[str, dict] = {}
