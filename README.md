# Generals.io Bot

一个用于 generals.io 游戏的 Node.js 机器人。

## 功能

- 自动连接 generals.io 服务器
- 支持自定义游戏
- 简单的随机移动策略（可扩展）

## 安装

```bash
npm install
```

## 运行

```bash
npm start
```

或者

```bash
node main.js
```

## 配置

在 `main.js` 中可以修改：
- `USERNAME`: 机器人名称
- `USER_ID`: 机器人ID（会自动生成）

## 游戏模式

当前支持自定义游戏（private game）。运行后会显示游戏链接，你可以访问该链接加入游戏。

## 策略

当前实现的是简单的随机移动策略。你可以在 `makeMove` 函数中实现更复杂的策略。

## License

MIT

