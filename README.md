# 文昌文旅 · 航小昌 H5 总集成界面

以「航小昌」宇航员 IP 为统一入口的文昌文旅 H5 应用，包含三大功能模块。

## 在线访问

| 页面 | 地址 |
| --- | --- |
| H5 总集成界面 | https://xiaochanglin.github.io/wenchangxin-1/ |
| 需求确认书 | https://xiaochanglin.github.io/wenchangxin-1/requirement.html |

> 仓库地址：https://github.com/xiaochanglin/wenchangxin-1

## 功能模块

1. **首页（问答）**：航小昌文旅问答，必玩/酒店大卡原地切换；点击地图卡自动回答「文昌必玩的景点有哪些？」
2. **酒店智能体**：瑶光小阁民宿卡片 → 酒店场景化智能问答（房态/房型/价格/周边）
3. **优选商城**：供应链直供商城（文昌美食/椰子好物/航天文创/海鲜干货，分类筛选+购物车）

## 本地运行

```bash
cd app
npm install
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY 或 GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

- 无 API key 时：快捷提问走前端预设答案，可正常演示；自由提问不可用
- 线上 GitHub Pages 为纯静态站点，`/api/chat` 不可用，快捷提问（预设答案）不受影响
- 完整 AI 对话需部署 `server.ts` 后端（Vercel/Render）并配置 `DEEPSEEK_API_KEY`

## 部署

GitHub Actions 自动部署到 Pages（workflow 模式）：push 到 `main` 分支即触发 `vite build`（`GITHUB_PAGES=true`，base 按仓库名动态生成）并发布 `app/dist`。

## 技术栈

React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Express（本地/后端一体服务）+ DeepSeek API
