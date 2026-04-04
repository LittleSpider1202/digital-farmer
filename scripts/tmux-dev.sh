#!/bin/bash
# 数字农人 — tmux 开发环境启动脚本
#
# Tab 1 [dev] - 3 个 agent 窗格（左1右2）
#   左: 架构师 (Claude Code)
#   右上: 开发者 (Claude Code)
#   右下: 评估者 (Claude Code)
#
# Tab 2 [monitor] - 服务监控
#   左: 前端 Next.js dev server
#   右: 后端 FastAPI dev server

SESSION="farmer"
DIR="$HOME/workspace/code/digital-farmer"
REMOTE="hz@192.168.0.112"
REMOTE_DIR="~/workspace/code/digital-farmer"

# 如果 session 已存在，直接 attach
tmux has-session -t $SESSION 2>/dev/null
if [ $? -eq 0 ]; then
    tmux attach-session -t $SESSION
    exit 0
fi

# ========== Tab 1: dev ==========
tmux new-session -d -s $SESSION -n dev -c "$DIR"

# 左右分屏
tmux split-window -h -t $SESSION:dev -c "$DIR"
# 右侧再上下分屏
tmux split-window -v -t $SESSION:dev.2 -c "$DIR"

# 左窗格 (pane 1): 架构师
tmux send-keys -t $SESSION:dev.1 "clear && echo '[ 架构师 ] claude'" C-m

# 右上窗格 (pane 2): 开发者 → SSH 小主机
tmux send-keys -t $SESSION:dev.2 "ssh -t $REMOTE 'cd $REMOTE_DIR && bash -l'" C-m

# 右下窗格 (pane 3): 评估者 → SSH 小主机
tmux send-keys -t $SESSION:dev.3 "ssh -t $REMOTE 'cd $REMOTE_DIR && bash -l'" C-m

# 左窗格占 55%
tmux resize-pane -t $SESSION:dev.1 -x "55%"

# ========== Tab 2: monitor ==========
tmux new-window -t $SESSION -n monitor -c "$DIR"

# 左窗格: 前端 dev server
tmux send-keys -t $SESSION:monitor "echo '[ Frontend ] npm run dev'" C-m

# 右窗格: 后端 dev server
tmux split-window -h -t $SESSION:monitor -c "$DIR"
tmux send-keys -t $SESSION:monitor.2 "echo '[ Backend ] uvicorn'" C-m

# ========== 聚焦到 Tab 1 左窗格 ==========
tmux select-window -t $SESSION:dev
tmux select-pane -t $SESSION:dev.1

# Attach
tmux attach-session -t $SESSION
