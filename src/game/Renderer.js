// Canvas渲染器
class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.setupCanvas()
  }

  setupCanvas() {
    const resize = () => {
      // 简化版：直接使用窗口尺寸，不处理devicePixelRatio
      // 这样可以避免坐标系统复杂化
      const rect = this.canvas.getBoundingClientRect()
      
      // 设置Canvas尺寸为CSS尺寸（1:1对应）
      this.canvas.width = rect.width
      this.canvas.height = rect.height
    }
    resize()
    window.addEventListener('resize', resize)
  }

  render(gameState, selectedTile = null) {
    if (!gameState || !gameState.map) return

    const { map } = gameState
    const ctx = this.ctx

    // 获取Canvas的CSS尺寸（不是像素尺寸）
    const rect = this.canvas.getBoundingClientRect()
    const canvasWidth = rect.width
    const canvasHeight = rect.height

    // 清空画布
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // 计算格子大小（使用CSS尺寸）
    const tileSize = Math.min(
      canvasWidth / map.width,
      canvasHeight / map.height
    )

    const offsetX = (canvasWidth - map.width * tileSize) / 2
    const offsetY = (canvasHeight - map.height * tileSize) / 2

    // 绘制格子
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        const px = offsetX + x * tileSize
        const py = offsetY + y * tileSize

        // 检查是否被选中
        const isSelected = selectedTile && selectedTile.x === x && selectedTile.y === y

        // 绘制格子背景
        this.drawTile(ctx, px, py, tileSize, tile, gameState.currentPlayer, isSelected)
      }
    }
  }

  drawTile(ctx, x, y, size, tile, currentPlayer, isSelected = false) {
    // 格子颜色
    let color = '#374151' // 默认灰色

    if (tile.type === 1) { // 山区
      color = '#4b5563'
    } else if (tile.owner === 0) { // 中立
      color = '#6b7280'
    } else if (tile.owner === currentPlayer) { // 己方
      color = '#3b82f6'
    } else { // 敌方
      color = '#ef4444'
    }

    // 绘制格子
    ctx.fillStyle = color
    ctx.fillRect(x, y, size, size)

    // 如果被选中，绘制高亮边框
    if (isSelected) {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
    }

    // 绘制边框
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, size, size)

    // 绘制单位数（被占领的格子且单位数>0才显示）
    if (tile.owner !== 0 && tile.type !== 1 && tile.units > 0) { // 不是中立且不是山区且单位数>0
      const fontSize = Math.max(12, size * 0.28)
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      const textX = x + size / 2
      const textY = y + size / 2
      const text = tile.units.toString()
      
      // 添加文字描边以提高可读性
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = Math.max(2, size * 0.05)
      ctx.strokeText(text, textX, textY)
      
      // 绘制文字
      ctx.fillStyle = '#ffffff'
      ctx.fillText(text, textX, textY)
    }

    // 绘制特殊标记（在单位数下方或上方）
    if (tile.type === 2) { // 要塞 - 绘制小圆点
      ctx.fillStyle = '#fbbf24'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 1
      ctx.beginPath()
      // 绘制在右上角
      ctx.arc(x + size * 0.8, y + size * 0.2, size * 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else if (tile.type === 3) { // 首都 - 绘制星形（皇冠）
      const centerX = x + size * 0.8
      const centerY = y + size * 0.2
      const radius = size * 0.2
      
      ctx.fillStyle = '#fbbf24'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      
      // 绘制星形（5角星）
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2
        const x1 = centerX + radius * Math.cos(angle)
        const y1 = centerY + radius * Math.sin(angle)
        
        if (i === 0) {
          ctx.moveTo(x1, y1)
        } else {
          ctx.lineTo(x1, y1)
        }
        
        // 内角
        const innerAngle = angle + (2 * Math.PI / 5)
        const x2 = centerX + radius * 0.4 * Math.cos(innerAngle)
        const y2 = centerY + radius * 0.4 * Math.sin(innerAngle)
        ctx.lineTo(x2, y2)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  destroy() {
    // 清理资源
  }
}

export default Renderer

