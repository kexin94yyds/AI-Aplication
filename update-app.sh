#!/bin/bash

# AI Sidebar 应用更新脚本
# 自动打包并更新应用到 /Applications/AI Sidebar.app

set -e  # 遇到错误立即退出

# 快速模式：跳过清理dist，利用增量构建
FAST_MODE=false
SKIP_BACKUP=false
for arg in "$@"; do
    case $arg in
        --fast|-f) FAST_MODE=true; SKIP_BACKUP=true ;;
        --no-backup) SKIP_BACKUP=true ;;
    esac
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AI Sidebar 应用更新脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 停止正在运行的应用
echo -e "${YELLOW}[1/5] 停止正在运行的应用...${NC}"
pkill -f "AI Sidebar" 2>/dev/null || echo "  没有运行中的应用"
sleep 1

# 2. 清理旧的打包文件（快速模式跳过）
if [ "$FAST_MODE" = true ]; then
    echo -e "${YELLOW}[2/5] 跳过清理（快速模式）${NC}"
else
    echo -e "${YELLOW}[2/5] 清理旧的打包文件...${NC}"
    rm -rf dist
    echo "  ✓ 清理完成"
fi

# 3. 打包应用
echo -e "${YELLOW}[3/5] 开始打包应用...${NC}"
npm run pack
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 打包失败！${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ 打包完成${NC}"

# 4. 检查打包结果
PACKED_APP="dist/mac-arm64/AI Sidebar.app"
if [ ! -d "$PACKED_APP" ]; then
    echo -e "${RED}✗ 找不到打包后的应用: $PACKED_APP${NC}"
    exit 1
fi

# 5. 更新应用
echo -e "${YELLOW}[4/5] 更新应用到 /Applications/AI Sidebar.app...${NC}"
TARGET_APP="/Applications/AI Sidebar.app"

if [ ! -d "$TARGET_APP" ]; then
    echo -e "${RED}✗ 目标应用不存在: $TARGET_APP${NC}"
    echo -e "${YELLOW}  请先安装应用，或手动复制整个应用${NC}"
    exit 1
fi

# 将所有需要管理员权限的操作合并到一个命令中，只需输入一次密码
echo "  正在更新 Contents（需要管理员权限，只需输入一次密码）..."
BACKUP_DIR="${TARGET_APP}/Contents.backup.$(date +%Y%m%d_%H%M%S)"
PACKED_CONTENTS="$(pwd)/${PACKED_APP}/Contents"

# 创建临时脚本，包含所有需要权限的操作
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'SCRIPT_EOF'
#!/bin/bash
set -e

TARGET_APP="$1"
BACKUP_DIR="$2"
PACKED_CONTENTS="$3"

# 备份旧的 Contents（如果存在且未跳过）
SKIP_BACKUP_FLAG="$4"
if [ "$SKIP_BACKUP_FLAG" != "skip" ] && [ -d "${TARGET_APP}/Contents" ]; then
    echo "  备份旧版本到: ${BACKUP_DIR}"
    cp -R "${TARGET_APP}/Contents" "${BACKUP_DIR}" 2>/dev/null || echo "  备份失败"
elif [ "$SKIP_BACKUP_FLAG" = "skip" ]; then
    echo "  跳过备份（快速模式）"
fi

# 更新 Contents
echo "  正在更新 Contents..."
rm -rf "${TARGET_APP}/Contents"
cp -R "${PACKED_CONTENTS}" "${TARGET_APP}/Contents"

# 清理 Gatekeeper 隔离属性（防止开机后问题）
if xattr -l "${TARGET_APP}" 2>/dev/null | grep -q "com.apple.quarantine"; then
    xattr -dr com.apple.quarantine "${TARGET_APP}" 2>/dev/null || true
    echo "  ✓ 已清除 Gatekeeper 隔离属性"
fi

# 清理旧备份（保留最近3个）
BACKUP_COUNT=$(ls -d "${TARGET_APP}/Contents.backup."* 2>/dev/null | wc -l | tr -d ' ' || echo "0")
if [ "$BACKUP_COUNT" -gt 3 ]; then
    ls -dt "${TARGET_APP}/Contents.backup."* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    echo "  保留最近3个备份"
fi

# 清理单实例锁文件（防止开机后问题）
APP_SUPPORT_DIR="$HOME/Library/Application Support/AI Sidebar"
if [ -d "$APP_SUPPORT_DIR" ]; then
    rm -f "$APP_SUPPORT_DIR/SingletonLock" 2>/dev/null || true
    rm -f "$APP_SUPPORT_DIR/SingletonCookie" 2>/dev/null || true
    rm -f "$APP_SUPPORT_DIR/SingletonSocket" 2>/dev/null || true
    echo "  ✓ 已清理单实例锁文件"
fi

echo "更新完成"
SCRIPT_EOF

chmod +x "$TEMP_SCRIPT"

# 使用 osascript 执行临时脚本（只需输入一次密码）
SKIP_BACKUP_ARG=""
if [ "$SKIP_BACKUP" = true ]; then
    SKIP_BACKUP_ARG="skip"
fi
osascript -e "do shell script \"\\\"$TEMP_SCRIPT\\\" \\\"${TARGET_APP}\\\" \\\"${BACKUP_DIR}\\\" \\\"${PACKED_CONTENTS}\\\" \\\"${SKIP_BACKUP_ARG}\\\"\" with administrator privileges" 2>/dev/null

UPDATE_RESULT=$?

# 清理临时脚本
rm -f "$TEMP_SCRIPT"

if [ $UPDATE_RESULT -eq 0 ]; then
    echo -e "${GREEN}  ✓ 更新成功${NC}"
else
    echo -e "${RED}✗ 更新失败！可能需要管理员权限或用户取消了操作${NC}"
    echo ""
    echo -e "${YELLOW}请手动执行以下命令：${NC}"
    echo "  sudo rm -rf \"${TARGET_APP}/Contents\""
    echo "  sudo cp -R \"$(pwd)/${PACKED_APP}/Contents\" \"${TARGET_APP}/Contents\""
    exit 1
fi

# 6. 清理备份状态提示
echo -e "${YELLOW}[5/5] 备份管理完成${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 更新完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "应用已更新到最新版本。"
echo "你可以在应用程序中启动 'AI Sidebar' 来使用新版本。"
echo ""
echo -e "${YELLOW}提示: 使用 --fast 或 -f 参数可加速更新（跳过清理和备份）${NC}"



