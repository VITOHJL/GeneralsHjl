# 部署说明

## 构建文件位置
构建后的文件在 `dist/` 目录中，包含：
- `index.html` - 入口文件
- `assets/` - 静态资源（JS、CSS）

## 部署步骤

### 1. 上传文件
将 `dist/` 目录中的所有文件上传到服务器的 web 根目录（例如：`/var/www/html/` 或 `/usr/share/nginx/html/`）

### 2. 服务器配置（Nginx 示例）

如果使用 Nginx，需要配置如下：

```nginx
server {
    listen 80;
    server_name 139.196.231.77;
    
    root /var/www/html;  # 或你的实际路径
    index index.html;
    
    # 支持 SPA 路由（如果需要）
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. 文件权限
确保 web 服务器有读取权限：
```bash
chmod -R 755 /var/www/html
chown -R www-data:www-data /var/www/html  # 根据实际情况调整用户组
```

### 4. 重启服务
```bash
# Nginx
sudo systemctl restart nginx

# 或 Apache
sudo systemctl restart apache2
```

## 快速部署命令（SSH）

如果服务器支持 SSH，可以使用以下命令：

```bash
# 1. 在本地打包
tar -czf dist.tar.gz dist/

# 2. 上传到服务器
scp dist.tar.gz user@139.196.231.77:/tmp/

# 3. SSH 到服务器并解压
ssh user@139.196.231.77
cd /var/www/html  # 或你的 web 根目录
tar -xzf /tmp/dist.tar.gz
mv dist/* .
rm -rf dist dist.tar.gz
```

## 验证
访问 http://139.196.231.77/ 查看是否正常显示游戏界面。

