#!/bin/bash

# AI Sidebar 清理启动脚本
# 解决开机后应用需要重启才生效的问题（窗口跳动问题）
# 
# 问题原因：
# 1. Electron 单实例锁文件残留（系统关机时未正常退出）
# 2. macOS Gatekeeper 隔离属性
# 3. macOS Spaces 机制与窗口状态冲突
#
# 使用方法：
#   cd "/Users/apple/全局 ai 侧边栏/AI-Sidebar"
#   ./clean-start.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_NAME="AI Sidebar"
APP_PATH="/Applications/AI Sidebar.app"
APP_SUPPORT="$HOME/Library/Application Support/AI Sidebar"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Sidebar 清理启动脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 强制关闭所有相关进程
echo -e "${YELLOW}[1/4] 关闭所有 AI Sidebar 进程...${NC}"
pkill -9 -f "AI Sidebar" 2>/dev/null && echo "  ✓ 已关闭主进程" || echo "  - 没有运行中的主进程"
pkill -9 -f "AI Sidebar Helper" 2>/dev/null && echo "  ✓ 已关闭 Helper 进程" || echo "  - 没有运行中的 Helper 进程"
sleep 1

# 2. 清理单实例锁文件
echo -e "${YELLOW}[2/4] 清理单实例锁文件...${NC}"
if [ -d "$APP_SUPPORT" ]; then
    rm -f "$APP_SUPPORT/SingletonLock" 2>/dev/null && echo "  ✓ 已删除 SingletonLock" || echo "  - SingletonLock 不存在"
    rm -f "$APP_SUPPORT/SingletonCookie" 2>/dev/null && echo "  ✓ 已删除 SingletonCookie" || echo "  - SingletonCookie 不存在"
    rm -f "$APP_SUPPORT/SingletonSocket" 2>/dev/null && echo "  ✓ 已删除 SingletonSocket" || echo "  - SingletonSocket 不存在"
else
    echo "  - 应用数据目录不存在，跳过"
fi

# 3. 清理 Gatekeeper 隔离属性
echo -e "${YELLOW}[3/4] 清理 Gatekeeper 隔离属性...${NC}"
if [ -d "$APP_PATH" ]; then
    if xattr -l "$APP_PATH" 2>/dev/null | grep -q "com.apple.quarantine"; then
        xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null && echo "  ✓ 已清除隔离属性" || echo "  ⚠ 清除隔离属性失败（可能需要管理员权限）"
    else
        echo "  - 没有隔离属性，跳过"
    fi
else
    echo "  ⚠ 应用不存在: $APP_PATH"
fi

# 4. 重新启动应用
echo -e "${YELLOW}[4/4] 启动应用...${NC}"
if [ -d "$APP_PATH" ]; then
    open "$APP_PATH"
    echo -e "${GREEN}  ✓ 应用已启动${NC}"
else
    echo -e "${RED}  ✗ 无法启动：应用不存在${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 清理启动完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "如果问题仍然存在，请检查："
echo "  1. 应用版本是否正确：md5 \"$APP_PATH/Contents/Resources/app.asar\""
echo "  2. 是否有残留进程：ps aux | grep -i 'AI Sidebar'"
echo "  3. 锁文件是否存在：ls -la \"$APP_SUPPORT/Singleton*\""
echo ""
