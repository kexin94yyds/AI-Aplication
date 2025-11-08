#!/bin/bash

# AI Sidebar 应用更新脚本
# 自动打包并更新应用到 /Applications/AI Sidebar.app

set -e  # 遇到错误立即退出

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

# 2. 清理旧的打包文件
echo -e "${YELLOW}[2/5] 清理旧的打包文件...${NC}"
rm -rf dist
echo "  ✓ 清理完成"

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

# 备份旧的 Contents（如果存在）
if [ -d "${TARGET_APP}/Contents" ]; then
    echo "  备份旧版本到: ${BACKUP_DIR}"
    cp -R "${TARGET_APP}/Contents" "${BACKUP_DIR}" 2>/dev/null || echo "  备份失败"
fi

# 更新 Contents
echo "  正在更新 Contents..."
rm -rf "${TARGET_APP}/Contents"
cp -R "${PACKED_CONTENTS}" "${TARGET_APP}/Contents"

# 清理旧备份（保留最近3个）
BACKUP_COUNT=$(ls -d "${TARGET_APP}/Contents.backup."* 2>/dev/null | wc -l | tr -d ' ' || echo "0")
if [ "$BACKUP_COUNT" -gt 3 ]; then
    ls -dt "${TARGET_APP}/Contents.backup."* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    echo "  保留最近3个备份"
fi

echo "更新完成"
SCRIPT_EOF

chmod +x "$TEMP_SCRIPT"

# 使用 osascript 执行临时脚本（只需输入一次密码）
osascript -e "do shell script \"\\\"$TEMP_SCRIPT\\\" \\\"${TARGET_APP}\\\" \\\"${BACKUP_DIR}\\\" \\\"${PACKED_CONTENTS}\\\"\" with administrator privileges" 2>/dev/null

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



