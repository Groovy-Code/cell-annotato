# cell-annotato — AI Project Config

## 项目概述

细胞图像标注 MVP — 毕业项目。提供细胞图像上传、手工轮廓标注、标注审核等核心功能。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React (Vite) + TypeScript |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 后端 | Python 3.12+ / FastAPI |
| 数据库 | SQLite (MVP 阶段) → PostgreSQL (生产) |
| 图像处理 | Pillow / OpenCV |

## 项目结构

```
cell-annotato/
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/   # UI 组件
│   │   ├── pages/        # 路由页面
│   │   ├── hooks/        # 自定义 hooks
│   │   └── lib/          # 工具函数
│   └── package.json
├── backend/           # FastAPI 服务
│   ├── app/
│   │   ├── api/          # 路由接口
│   │   ├── models/       # 数据模型
│   │   ├── services/     # 业务逻辑
│   │   └── core/         # 配置、依赖注入
│   └── requirements.txt
├── docs/
│   └── adr/           # 架构决策记录
├── CONTEXT.md         # 领域术语表
├── CLAUDE.md          # 本文件
└── README.md
```

## 常用命令

```bash
# 前端
cd frontend && npm install && npm run dev          # 启动开发服务器
cd frontend && npm run build                        # 生产构建
cd frontend && npx vitest                            # 跑前端测试

# 后端
cd backend && pip install -r requirements.txt       # 安装依赖
cd backend && uvicorn app.main:app --reload         # 启动后端 (http://localhost:8000)
cd backend && pytest                                  # 跑后端测试
```

---

## Matt Pocock Skills 配置

> 以下配置被 to-prd、to-issues、grill-with-docs、tdd 等 skill 自动读取。

- **issue_tracker**: github
- **triage_label**: needs-triage
- **domain_doc**: CONTEXT.md
- **adr_path**: docs/adr/
- **github_repo**: https://github.com/Groovy-Code/cell-annotato.git
