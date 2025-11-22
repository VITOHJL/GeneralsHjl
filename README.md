# Generals.io - 本地单机游戏

一个基于 generals.io 游戏规则的本地单机策略游戏。玩家可以在本地与AI机器人对战，体验经典的领土扩张和策略对战玩法。

## 项目状态

🚧 **开发中** - 当前处于规划阶段

## 项目特点

- 🎮 **本地单机游戏** - 无需联网，本地运行
- 🤖 **AI机器人对手** - 多种难度等级的AI
- 🗺️ **随机地图生成** - 每次游戏都是新体验
- 🎯 **经典游戏规则** - 完全遵循 generals.io 的游戏规则
- 💻 **纯前端实现** - HTML5 + Canvas + JavaScript

## 游戏规则

### 基本玩法

1. **地图**: 网格地图，包含空地、山脉、城市和将军
2. **军队**: 每个己方格子每回合自动增长军队
3. **移动**: 从己方格子移动到相邻格子（需要至少2个军队）
4. **战斗**: 移动到敌方格子会触发战斗
5. **胜利**: 占领敌方将军或消灭所有敌方军队

### 详细规则

- **军队增长**: 普通格子+1/回合，城市+2/回合
- **战斗机制**: 攻击方军队数 > 防御方则占领，剩余 = 攻击方 - 防御方
- **移动限制**: 只能移动到相邻的上下左右四个方向
- **特殊格子**: 
  - 山脉：不可通过
  - 城市：提供额外军队增长
  - 将军：玩家起始点，被占领即失败

## 开发计划

详细开发计划请查看 [PROJECT_PLAN.md](./PROJECT_PLAN.md)

### 当前阶段

- [x] 项目规划
- [ ] 基础框架搭建
- [ ] 地图生成系统
- [ ] 游戏核心逻辑
- [ ] AI机器人
- [ ] UI界面

## 技术栈

- **HTML5 Canvas** - 游戏渲染
- **JavaScript (ES6+)** - 游戏逻辑
- **CSS3** - 界面样式

## 项目结构

```
generals.io/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── main.js         # 主入口
│   ├── game.js         # 游戏核心逻辑
│   ├── map.js          # 地图生成和管理
│   ├── player.js       # 玩家类
│   ├── ai.js           # AI机器人
│   ├── renderer.js     # 渲染引擎
│   └── utils.js        # 工具函数
├── assets/
│   ├── images/         # 图片资源
│   └── sounds/         # 音效资源
├── README.md
└── PROJECT_PLAN.md     # 详细开发计划
```

## 安装和运行

### 本地运行

1. 克隆仓库
```bash
git clone https://github.com/VITOHJL/GeneralsHjl.git
cd GeneralsHjl
```

2. 直接在浏览器中打开 `index.html`

或者使用本地服务器：
```bash
# 使用 Python
python -m http.server 8000

# 使用 Node.js (需要安装 http-server)
npx http-server
```

3. 在浏览器中访问 `http://localhost:8000`

## 功能特性

### 已实现
- [x] 项目规划文档

### 计划实现
- [ ] 地图生成系统
- [ ] 游戏核心逻辑
- [ ] 玩家操作交互
- [ ] AI机器人（多种难度）
- [ ] 游戏UI界面
- [ ] 音效和动画
- [ ] 游戏统计和回放

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

MIT

## 参考资料

- [Generals.io 官方网站](https://generals.io)
- [Generals.io 游戏规则](https://generals.io/help)

---

**注意**: 这是一个独立开发的游戏项目，与官方的 generals.io 无关。
