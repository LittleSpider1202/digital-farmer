# Bug: 点发送按钮后页面闪烁

## 现象

上传图片后点发送按钮（白色箭头），页面会闪一下（整个内容区域似乎向下跳一帧然后恢复）。

## 环境

- Next.js 16.2.2 (Turbopack, dev mode)
- React 19
- 后端返回 503（API 未启动），但即使 API 正常也会闪

## 已排除的原因

1. **标题显隐** — 已改为始终显示，不再条件渲染
2. **setResult(null) 导致空帧** — 已改为不提前清 result，loading 时直接显示骨架屏
3. **justify-center 重新计算** — 已改为固定 paddingTop:30vh
4. **scrollbar 出现/消失** — 已加 scrollbar-gutter:stable + overflow-y:scroll
5. **Next.js dev overlay** — 隐藏后仍然闪
6. **CSS transition/animation** — 全局禁用后仍然闪
7. **重绘闪烁** — 已加 translateZ(0) 独立合成层
8. **useCallback 依赖重建** — 已用 useMemo 稳定 images 引用

## 关键文件

- `src/frontend/app/page.tsx` — 主页面，包含所有状态和渲染逻辑
- `src/frontend/app/globals.css` — 全局样式
- `src/frontend/app/layout.tsx` — body 背景色

## 复现步骤

1. `cd src/frontend && npm run dev`
2. 打开 localhost:3000
3. 点 + 按钮上传一张图片
4. 点白色箭头发送按钮
5. 观察：整个页面内容会闪一下（向下跳一帧然后恢复）

## 怀疑方向

- Next.js 16 / React 19 的 hydration 或 state batch 更新导致中间渲染帧
- Turbopack dev server 的 HMR 或 error overlay 干扰
- body/html 的 overflow 设置与内容高度变化的交互
- `setLoading(true)` 触发的重渲染路径中有某个组件的 mount/unmount 导致布局跳动

## 要求

请找到闪烁的根本原因并修复。可以用 `npm run dev` 启动前端，上传图片后点发送来复现。
