# cell-annotato MVP 需求清单 v1

> 整理时间: 2026-06-23
> 状态: 待审核

---

## 一、项目定位

**单细胞转录组空间标注平台** — 人机博弈置信度审计引擎。

- 不是 CV 图像分割，不是病理切片描边
- 基于空间转录组数据的交互式散点图（`centroid_x` / `centroid_y`）
- AI (scBERT) 预标注 → 专家框选纠偏 → 证据链打分 → 及格入库 / 不及格进复审池
- 毕业项目 MVP，React + FastAPI + SQLite

---

## 二、核心业务流程

```
上传 .h5ad → 后端解析入库 → Mock scBERT 标注
    → 散点图可视化（按 AI 预测着色）
    → 专家框选争议细胞区域
    → 右侧面板展示 AI 预测依据（Literature markers）
    → 点击"修改注释"唤起纠偏弹窗（强校验）
    → 提交证据链 → 加权打分
         ├→ score ≥ 0.6 → 入库（通过）
         └→ score < 0.6 → 进复审池
    → 仪表盘反馈整体质量报告
```

---

## 三、页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 数据集列表页 | 首页，浏览已上传数据集，显示名称/细胞数/标注进度/上传时间 |
| `/annotate/:id` | 标注工作台 | 核心页面：散点图 + 右侧解释面板 + 纠偏弹窗 |
| `/upload` | 数据上传页 | 上传 .h5ad，进度条，自动匹配 mock 输出文件 |
| `/review` | 复审池页 | 查看不及格记录，支持补充证据重新提交 |
| `/dashboard/:id` | 质量报告仪表盘 | 数据集统计 + 人机不一致分析 + 纠偏审计 |

路由进入标注工作台前，需输入姓名（简单身份，无密码）。

---

## 四、标注工作台详细设计

### 4.1 左侧：散点图 (ECharts WebGL)

- **库**: Apache ECharts（Canvas + WebGL 双引擎）
- **数据量**: ~17,000 个点
- **坐标**: `centroid_x` / `centroid_y`（空间坐标，MVP 先用这个，以后加 UMAP 切换）
- **着色**:
  - **Annotation 模式**（默认）: 按 `scbert_predict` 一级分类着色（10 种颜色）
  - **Confidence 模式**: 按 `scbert_predict_top1_prob` 热力图（引导专家先看低置信区）
  - 两种模式通过 Toolbar 按钮切换
- **图例**: 底部展示，每种细胞类型的颜色 + 数量，可点击显示/隐藏
- **交互**:
  - **套索选择** (Lasso) / **框选** (Box Select)
  - 选中后获取细胞 ID 数组，传递给右侧面板
  - 修改注释按钮：未选中时 disabled，选中后点亮
- **Hover**: tooltip 显示完整层级路径（如 `Monocytes / Monocyte-derived cells/Monocyte-derived macrophages`）

### 4.2 右侧：解释面板 (Explanation Panel)

面板在选中细胞后才展示完整信息：

| 模块 | 内容 | 数据来源 |
|------|------|---------|
| **预测结论** | AI 预测细胞类型（一级分类）+ 选中细胞平均 Confidence Score | `scbert_predict` + `scbert_predict_top1_prob` |
| **Literature Markers** | 该细胞类型的经典文献 Marker 基因（以 Tag 形式展示） | 后端 MARKER_DICT 模糊匹配返回 |
| **BERT-highlighted genes** | 占位模块，置灰 + "Advanced info" tag | 纯前端占位，未来接真实数据 |
| **操作按钮** | "手动修改 Annotation (纠偏)" | 点击唤起纠偏弹窗 |

### 4.3 纠偏弹窗（强校验 — 核心交互）

弹窗包含 4 个必填交互核心：

#### ① 纠正为 (Target Cell Type)
- 支持搜索的下拉单选框 (Combobox)
- 标签来源于数据集的 `scbert_predict` 唯一值词表
- **不允许**自由输入

#### ② 证据类型 (Evidence Type)
- 单选下拉菜单，选项：
  - **Marker Genes**（权重 1.0）
  - **Published Literature**（权重 0.7）
  - **Visual Intuition**（权重 0.3）

#### ③ 动态证据输入框（根据 ② 条件渲染）

| 证据类型 | 组件 | 要求 |
|---------|------|------|
| Marker Genes | 异步防抖多选搜索 Combobox | 防抖 300ms → 调用后端 API → 返回 Top 50 匹配基因名 → 渲染下拉供勾选。选中以 Tags 展示，可删除 |
| Published Literature | 普通 Input | 强制正则校验，只允许纯数字 PMID |
| Visual Intuition | Textarea（非必填） | 唯一允许自由文本的地方，但权重最低 |

#### ④ 把握度 (Confidence Factor)
- 0-100% Slider，默认 80%

### 4.4 打分算法

```
score = 证据权重 × (置信度 / 100)

权重:
  Marker Genes         = 1.0
  Published Literature = 0.7
  Visual Intuition     = 0.3

判定:
  score ≥ 0.6 → passed（直接入库）
  score < 0.6 → pending_review（进复审池）
```

### 4.5 复审池

- 列表展示所有不及格 record
- 标注员本人可点击进入，补充证据重新提交
- 字段：数据集、细胞数、原标签 → 修改为、证据类型、得分、提交时间

---

## 五、仪表盘 (Dashboard)

| 模块 | 可视化 | 数据 |
|------|--------|------|
| **数据集概览** | 总细胞数、细胞类型分布饼图 | `current_label` 统计 |
| **AI 置信度分布** | 直方图分桶 (0-0.5 / 0.5-0.7 / 0.7-0.9 / 0.9-1.0) | `scbert_predict_top1_prob` |
| **人机不一致热力图** | UMAP 缩略图标出被纠正过的点 | `annotations` 关联 `cells` |
| **纠偏统计** | 总次数、证据类型占比饼图、平均置信度、通过率 | `annotations` 聚合 |
| **争议热点 TopN** | 被修改次数最多的细胞区域/类型排行 | `annotations` 按 `target_cell_type` 分组 |

---

## 六、数据管线

### 6.1 上传流程
```
用户上传 xxx.h5ad (输入) 
  → 后端按 {basename}_predict.h5ad 命名约定自动匹配输出文件
  → 合并 scbert_predict 列到 cells 表
  → 提取 var['gene'] 所有基因名 → 写入 datasets.gene_vocabulary (JSON)
  → 前端拿到数据集 ID，渲染散点图
```

### 6.2 Mock scBERT
- 输入/输出 h5ad 文件名配对约定：`{base}_predict.h5ad`
- 未找到配对输出文件 → 报错
- 以后模型到位：替换 mock 函数即可，接口不变

---

## 七、数据格式

### 7.1 输入 h5ad 结构 (已知)
```
obs: cell, original_cell_id, centroid_x, centroid_y, centroid_z, component, 
     volume, surface_area, scale, region, QC 指标...
var: gene (29,437 个基因名)
obsm: spatial
形状: 17,045 cells × 29,437 genes
```

### 7.2 输出 h5ad 结构 (scBERT 预测结果，新增列)
```
obs (新增): scbert_predict, scbert_predict_top1_prob, 
            scbert_predict_top2_label, scbert_predict_top2_prob, 
            scbert_predict_margin
```

### 7.3 10 种细胞类型及数量
```
Hepatocytes                                          12,744 (74.8%)
Monocytes / Monocyte-derived cells/...                2,626 (15.4%)
Stromal cells                                         1,263 ( 7.4%)
B cells/B                                               247 ( 1.4%)
Endothelial cells                                       142 ( 0.8%)
T cells/T                                                12 ( 0.07%)
Kupffer cells/KCs                                         6 ( 0.04%)
Fibroblasts/Myofibroblasts                                2
cDC1s/cDC2s                                               2
Cholangiocytes                                            1
```

---

## 八、Marker 基因字典

- **命名规范**: 小鼠 (Mouse) — 首字母大写，其余小写（如 `Cd3d`, `Cd4`）
- **匹配逻辑**: 输入标签转小写 → 遍历字典 key → 包含则命中
- **10/10 全覆盖**: 所有 10 种细胞类型均可命中，零 fallback
- **兜底策略**: 未匹配时返回 `["No literature markers found for this specific subtype"]`

---

## 九、基因异步搜索

- 上传 h5ad 时提取 `var['gene']` 全部基因名
- 写入 `datasets.gene_vocabulary`（TEXT 字段，JSON 数组）
- 后端启动时载入内存缓存
- 搜索 API: 接受关键词 → 内存 `LIKE` 匹配 → 返回 Top 50
- 防抖 300ms

---

## 十、技术选型

| 层 | 选型 |
|----|------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 图表库 | Apache ECharts (WebGL 模式) |
| 状态管理 | Zustand |
| API 调用 | TanStack Query (React Query) |
| 路由 | React Router v6 |
| 后端框架 | FastAPI + Pydantic |
| 数据库 | SQLite |
| h5ad 解析 | h5py / anndata |
| 图表库 | ECharts |

---

## 十一、数据库表结构

| 表 | 核心字段 | 说明 |
|----|---------|------|
| `datasets` | id, name, file_path, cell_count, gene_vocabulary(TEXT/JSON), status, created_at | 上传的数据集 |
| `cells` | id, dataset_id, centroid_x, centroid_y, scbert_predict, scbert_predict_top1_prob, scbert_predict_top2_label, scbert_predict_top2_prob, scbert_predict_margin, current_label | 每个细胞一行 |
| `annotations` | id, dataset_id, cell_ids(TEXT/JSON), target_cell_type, evidence_type, evidence_data(TEXT), confidence, score, status, annotator_name, created_at | 一次纠偏行为一条记录 |

> genes 表已砍掉 — 基因搜索走内存缓存 + datasets.gene_vocabulary

---

## 十二、待讨论 / 后期扩展

- [ ] scBERT 真实模型接入（替换 mock）
- [ ] UMAP 降维坐标支持（`obsm` 中追加）
- [ ] BERT-highlighted genes 真实数据接入（替换占位）
- [ ] 用户注册/登录/会话管理（替换简单姓名）
- [ ] Fine-tune 反馈回路（专家纠偏 → 回传训练）
- [ ] 多用户审核角色及审核流
- [ ] PostgreSQL 迁移
- [ ] `.h5ad` 预处理管线（QC → 降维 → 预测 → 入库）
