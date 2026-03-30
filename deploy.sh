#!/bin/bash
# AI全家桶 aibar.xin 部署脚本
# 使用方法：在本地运行 ./deploy.sh 然后按提示操作

set -e

echo "🚀 AI全家桶部署脚本"
echo "===================="

# 配置
LOCAL_DIST_PATH="/Users/apple/Downloads/ai全家桶---聚合ai侧边栏/dist"
SERVER_IP="${SERVER_IP:-your-server-ip}"
SERVER_USER="${SERVER_USER:-root}"
DOMAIN="aibar.xin"
REMOTE_PATH="/var/www/aibar.xin"

echo ""
echo "📋 部署配置："
echo "  域名: $DOMAIN"
echo "  服务器: $SERVER_USER@$SERVER_IP"
echo "  远程路径: $REMOTE_PATH"
echo ""

# 步骤 1: 检查本地构建
echo "🔍 检查本地构建..."
if [ ! -d "$LOCAL_DIST_PATH" ]; then
    echo "❌ 错误: 本地 dist 文件夹不存在"
    echo "请先运行: npm run build"
    exit 1
fi
echo "✅ 本地 dist 文件夹存在"

# 步骤 2: 上传到服务器
echo ""
echo "📤 上传文件到服务器..."
echo "需要输入服务器密码..."

# 创建远程目录并上传
ssh "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_PATH"

# 使用 rsync 上传（比 scp 更快，支持断点续传）
rsync -avz --delete "$LOCAL_DIST_PATH/" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/"

echo "✅ 文件上传完成"

# 步骤 3: SSH 到服务器配置 Nginx
echo ""
echo "🔧 配置服务器..."
echo "需要输入服务器密码..."

ssh "$SERVER_USER@$SERVER_IP" << 'REMOTE_COMMANDS'

DOMAIN="aibar.xin"
REMOTE_PATH="/var/www/aibar.xin"

echo "检查 Nginx 安装..."
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    apt update
    apt install -y nginx
fi

echo "配置 Nginx 站点..."
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    root $REMOTE_PATH;
    index index.html;
    
    # 启用 gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx

echo "✅ Nginx 配置完成"

# 检查 Certbot
echo ""
echo "🔒 配置 HTTPS..."
if ! command -v certbot &> /dev/null; then
    echo "安装 Certbot..."
    apt install -y certbot python3-certbot-nginx
fi

# 自动获取证书
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || true

echo "✅ HTTPS 配置完成"

REMOTE_COMMANDS

echo ""
echo "🎉 部署完成！"
echo "===================="
echo ""
echo "网站地址:"
echo "  HTTP:  http://$DOMAIN"
echo "  HTTPS: https://$DOMAIN"
echo ""
echo "📋 部署后检查清单："
echo "  ☐ DNS 解析已配置（aibar.xin → $SERVER_IP）"
echo "  ☐ 网站可以正常访问"
echo "  ☐ HTTPS 证书生效"
echo ""
