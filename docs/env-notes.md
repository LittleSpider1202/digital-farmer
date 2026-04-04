# 环境踩坑记录

> 遇到环境问题时记录在这里，避免重复踩坑。

## 双机开发环境

| | Mac (本地) | 小主机 (192.168.0.112) |
|---|---|---|
| 用途 | 架构师 Claude Code | 开发者/评估者 Codex + 前后端服务 |
| 系统 | macOS 26.3.2 arm64 | Debian 13 trixie x86_64 |
| Node.js | v24.14.1 | v22.22.0 |
| Python | 3.9.6 (系统) | 3.13.5 (venv: ~/.venvs/digital-farmer) |
| 项目路径 | ~/workspace/code/digital-farmer | ~/workspace/code/digital-farmer |

## Mac 环境

- Python 命令用 `python3`，不是 `py`（Windows）也不是 `python`
- 本机运行 Clash Verge 代理，国内 API 需走直连
- 终端：Ghostty + tmux，启动脚本 `scripts/tmux-dev.sh`

## 小主机环境

- SSH: `ssh hz@192.168.0.112`（密码: daisytop1）
- Python venv: `source ~/.venvs/digital-farmer/bin/activate`
- PyPI 无法直连，需用阿里云镜像: `pip install -i https://mirrors.aliyun.com/pypi/simple/`
- GitHub 克隆有网络问题，项目通过 rsync 从 Mac 同步过去
- Codex 已安装: codex-cli 0.118.0
- 有 Docker 29.2.1 可用
