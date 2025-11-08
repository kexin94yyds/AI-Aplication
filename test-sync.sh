#!/bin/bash
# 测试 sync 功能是否正常工作

set -e

echo "🧪 测试 History 同步功能"
echo "========================="
echo ""

# 检测 sync 目录
SYNC_DIR="/Users/apple/AI-sidebar 更新/AI-Sidebar/sync"
if [ ! -d "$SYNC_DIR" ]; then
    echo "⚠️  sync 目录不存在，尝试创建..."
    mkdir -p "$SYNC_DIR"
fi

echo "📂 Sync 目录: $SYNC_DIR"
echo ""

# 检查 history.json
HISTORY_FILE="$SYNC_DIR/history.json"
if [ -f "$HISTORY_FILE" ]; then
    echo "✅ history.json 存在"
    HISTORY_COUNT=$(cat "$HISTORY_FILE" | jq 'length' 2>/dev/null || echo "无法解析")
    echo "   记录数: $HISTORY_COUNT"
    echo ""
    
    # 显示最新的 3 条记录
    if command -v jq &> /dev/null; then
        echo "📝 最新的 3 条历史记录:"
        cat "$HISTORY_FILE" | jq -r '.[:3] | .[] | "   - [\(.provider)] \(.title // "无标题") (\(.url | split("/")[-1] | .[0:16])...)"' 2>/dev/null || echo "   无法显示"
    fi
else
    echo "❌ history.json 不存在"
    echo "   请在浏览器插件中访问 AI 网站来创建历史记录"
fi

echo ""
echo "========================="
echo "🔍 监听文件变化测试"
echo "请在浏览器插件中访问 ChatGPT 并开始对话，然后观察此脚本输出..."
echo "（按 Ctrl+C 退出）"
echo ""

# 监听文件变化
if [ -f "$HISTORY_FILE" ]; then
    INITIAL_SIZE=$(stat -f%z "$HISTORY_FILE" 2>/dev/null || stat -c%s "$HISTORY_FILE" 2>/dev/null)
    echo "📊 初始文件大小: $INITIAL_SIZE bytes"
    echo ""
    
    while true; do
        sleep 2
        CURRENT_SIZE=$(stat -f%z "$HISTORY_FILE" 2>/dev/null || stat -c%s "$HISTORY_FILE" 2>/dev/null)
        
        if [ "$CURRENT_SIZE" != "$INITIAL_SIZE" ]; then
            echo "🔄 检测到文件变化！"
            NEW_COUNT=$(cat "$HISTORY_FILE" | jq 'length' 2>/dev/null || echo "?")
            echo "   新的记录数: $NEW_COUNT"
            echo "   文件大小: $CURRENT_SIZE bytes"
            
            # 显示最新添加的记录
            if command -v jq &> /dev/null; then
                echo "   最新记录:"
                cat "$HISTORY_FILE" | jq -r '.[0] | "   - [\(.provider)] \(.title // "无标题")\n     \(.url)"' 2>/dev/null || echo "   无法显示"
            fi
            
            echo ""
            INITIAL_SIZE=$CURRENT_SIZE
        fi
    done
else
    echo "❌ 无法监听：文件不存在"
fi




