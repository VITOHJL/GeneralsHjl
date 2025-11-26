// Canvas渲染器
import strongholdTexture from '../assets/tiles/stronghold.png'
import capitalTexture from '../assets/tiles/capital.png'
import obstacleTexture from '../assets/tiles/obstacle.png'

const TILE_TEXTURE_FILES = {
  stronghold: strongholdTexture,
  capital: capitalTexture,
  obstacle: obstacleTexture
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.setupCanvas()
    
    // 缓存上次渲染状态
    this.lastGameState = null
    this.lastSelectedTile = null
    this.dirtyTiles = new Set() // 需要重绘的格子 {x-y}
    this.canvasWidth = 0
    this.canvasHeight = 0
    this.tileSize = 0
    this.offsetX = 0
    this.offsetY = 0
    this.textures = {}
    this.loadTextures()
    
    // 离屏Canvas用于静态背景
    this.backgroundCanvas = null
    this.backgroundCtx = null
  }

  loadTextures() {
    Object.entries(TILE_TEXTURE_FILES).forEach(([key, relativePath]) => {
      const img = new Image()
      img.src = relativePath
      img.onload = () => this.markAllDirty()
      this.textures[key] = img
    })
  }

  setupCanvas() {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect()
      
      // 设置Canvas尺寸为CSS尺寸（1:1对应）
      this.canvas.width = rect.width
      this.canvas.height = rect.height
      
      // 缓存尺寸
      this.canvasWidth = rect.width
      this.canvasHeight = rect.height
      
      // 如果地图已加载，重新计算布局并标记所有格子为脏
      if (this.lastGameState?.map) {
        this.calculateLayout(this.lastGameState.map)
        this.markAllDirty(this.lastGameState.map)
      }
    }
    resize()
    window.addEventListener('resize', resize)
  }

  /**
   * 计算布局参数（缓存，避免每帧计算）
   */
  calculateLayout(map) {
    this.tileSize = Math.min(
      this.canvasWidth / map.width,
      this.canvasHeight / map.height
    )
    this.offsetX = (this.canvasWidth - map.width * this.tileSize) / 2
    this.offsetY = (this.canvasHeight - map.height * this.tileSize) / 2
  }

  /**
   * 标记所有格子为脏
   */
  markAllDirty(map = null) {
    // 如果没有提供map，使用lastGameState的map
    const targetMap = map || this.lastGameState?.map
    if (!targetMap) return
    
    this.dirtyTiles.clear()
    for (let y = 0; y < targetMap.height; y++) {
      for (let x = 0; x < targetMap.width; x++) {
        this.dirtyTiles.add(`${x}-${y}`)
      }
    }
  }

  /**
   * 标记格子为脏
   */
  markTileDirty(x, y) {
    this.dirtyTiles.add(`${x}-${y}`)
  }

  /**
   * 检测游戏状态变化，标记脏区域
   */
  detectChanges(newGameState, newSelectedTile) {
    if (!this.lastGameState || !newGameState) {
      // 首次渲染，标记所有格子（传入新地图）
      if (newGameState?.map) {
        this.markAllDirty(newGameState.map)
      }
      return
    }

    const oldState = this.lastGameState
    const newState = newGameState

    // 检查选中状态变化
    if (this.lastSelectedTile !== newSelectedTile) {
      // 如果之前有选中，标记为脏
      if (this.lastSelectedTile) {
        this.markTileDirty(this.lastSelectedTile.x, this.lastSelectedTile.y)
      }
      // 如果现在有选中，标记为脏
      if (newSelectedTile) {
        this.markTileDirty(newSelectedTile.x, newSelectedTile.y)
      }
    }

    // 检查当前玩家变化（影响颜色显示）
    if (oldState.currentPlayer !== newState.currentPlayer) {
      this.markAllDirty(newState.map)
      return
    }

    // 检查地图变化（简化：如果回合数变化，可能单位数变化）
    if (oldState.turn !== newState.turn || oldState.round !== newState.round) {
      // 标记所有格子为脏（因为单位数可能变化）
      this.markAllDirty(newState.map)
      return
    }

    // 检查特定格子变化（通过比较单位数和所有者）
    // 注意：这里简化处理，实际可以通过GameEngine提供变化列表
    // 暂时标记所有格子，后续可以优化为只标记变化的格子
    if (oldState.map && newState.map) {
      const oldMap = oldState.map
      const newMap = newState.map
      
      // 如果地图尺寸变化，全部重绘
      if (oldMap.width !== newMap.width || oldMap.height !== newMap.height) {
        this.markAllDirty(newMap)
        return
      }

      // 检查每个格子的变化
      for (let y = 0; y < newMap.height; y++) {
        for (let x = 0; x < newMap.width; x++) {
          const oldTile = oldMap.tiles[y][x]
          const newTile = newMap.tiles[y][x]
          
          // 如果单位数、所有者或类型变化，标记为脏
          if (oldTile.units !== newTile.units ||
              oldTile.owner !== newTile.owner ||
              oldTile.type !== newTile.type) {
            this.markTileDirty(x, y)
          }
        }
      }
    }
  }

  render(gameState, selectedTile = null) {
    if (!gameState || !gameState.map) return

    const { map } = gameState
    const ctx = this.ctx

    // 检测变化并标记脏区域
    this.detectChanges(gameState, selectedTile)

    // 如果尺寸变化，重新计算布局
    const rect = this.canvas.getBoundingClientRect()
    if (this.canvasWidth !== rect.width || this.canvasHeight !== rect.height) {
      this.canvasWidth = rect.width
      this.canvasHeight = rect.height
      this.canvas.width = rect.width
      this.canvas.height = rect.height
      this.calculateLayout(map)
      this.markAllDirty(map)
    } else {
      this.calculateLayout(map)
    }

    // 如果没有脏格子，跳过渲染
    if (this.dirtyTiles.size === 0) {
      this.lastGameState = gameState
      this.lastSelectedTile = selectedTile
      return
    }

    // 批量绘制：先绘制所有背景，再绘制所有边框，再绘制所有文字，最后绘制所有图标
    this.renderBatch(ctx, map, gameState.currentPlayer, selectedTile)

    // 更新缓存状态
    this.lastGameState = gameState
    this.lastSelectedTile = selectedTile
    this.dirtyTiles.clear()
  }

  /**
   * 批量渲染：合并同类绘制操作
   */
  renderBatch(ctx, map, currentPlayer, selectedTile) {
    // 准备批量数据
    const backgrounds = [] // [{x, y, color}]
    const texturedTiles = [] // [{x, y, type}]
    const borders = [] // [{x, y, color, width}]
    const texts = [] // [{x, y, text, fontSize}]
    const icons = [] // [{x, y, type}] type: 'stronghold' | 'capital'

    // 先清空脏区域（用背景色填充）
    ctx.fillStyle = '#1f2937'
    for (const tileKey of this.dirtyTiles) {
      const [x, y] = tileKey.split('-').map(Number)
      if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue
      const px = this.offsetX + x * this.tileSize
      const py = this.offsetY + y * this.tileSize
      ctx.fillRect(px, py, this.tileSize, this.tileSize)
    }

    // 收集需要绘制的格子数据
    for (const tileKey of this.dirtyTiles) {
      const [x, y] = tileKey.split('-').map(Number)
      if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue

      const tile = map.tiles[y][x]
      const px = this.offsetX + x * this.tileSize
      const py = this.offsetY + y * this.tileSize
      const isSelected = selectedTile && selectedTile.x === x && selectedTile.y === y

      // 确定颜色
      let color = '#374151'
      if (tile.type === 1) {
        color = '#4b5563'
      } else if (tile.owner === 0) {
        color = '#6b7280'
      } else if (tile.owner === currentPlayer) {
        color = '#3b82f6'
      } else {
        color = '#ef4444'
      }

      // 收集背景
      backgrounds.push({ x: px, y: py, color })

      // 收集贴图
      let textureType = null
      if (tile.type === 1) {
        textureType = 'obstacle'
      } else if (tile.type === 2) {
        textureType = 'stronghold'
      } else if (tile.type === 3) {
        textureType = 'capital'
      }
      if (textureType) {
        texturedTiles.push({ x: px, y: py, type: textureType })
      }

      // 收集边框
      if (isSelected) {
        borders.push({ x: px, y: py, color: '#fbbf24', width: 3 })
      }
      borders.push({ x: px, y: py, color: '#1f2937', width: 1 })

      // 收集文字
      if (tile.owner !== 0 && tile.type !== 1 && tile.units > 0) {
        texts.push({
          x: px + this.tileSize / 2,
          y: py + this.tileSize / 2,
          text: tile.units.toString(),
          fontSize: Math.max(12, this.tileSize * 0.28)
        })
      }

      // 收集图标
      if (!textureType) {
        if (tile.type === 2) {
          icons.push({ x: px, y: py, type: 'stronghold' })
        } else if (tile.type === 3) {
          icons.push({ x: px, y: py, type: 'capital' })
        }
      }
    }

    // 批量绘制背景
    for (const bg of backgrounds) {
      ctx.fillStyle = bg.color
      ctx.fillRect(bg.x, bg.y, this.tileSize, this.tileSize)
    }

    // 绘制贴图
    for (const tex of texturedTiles) {
      const image = this.textures[tex.type]
      if (image?.complete) {
        ctx.drawImage(image, tex.x, tex.y, this.tileSize, this.tileSize)
      }
    }

    // 批量绘制边框
    for (const border of borders) {
      ctx.strokeStyle = border.color
      ctx.lineWidth = border.width
      if (border.width === 3) {
        ctx.strokeRect(border.x + 1, border.y + 1, this.tileSize - 2, this.tileSize - 2)
      } else {
        ctx.strokeRect(border.x, border.y, this.tileSize, this.tileSize)
      }
    }

    // 批量绘制文字
    if (texts.length > 0) {
      for (const text of texts) {
        ctx.font = `bold ${text.fontSize}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // 描边
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = Math.max(2, this.tileSize * 0.05)
        ctx.strokeText(text.text, text.x, text.y)
        
        // 填充
        ctx.fillStyle = '#ffffff'
        ctx.fillText(text.text, text.x, text.y)
      }
    }

    // 批量绘制图标
    for (const icon of icons) {
      const centerX = icon.x + this.tileSize * 0.8
      const centerY = icon.y + this.tileSize * 0.2
      
      ctx.fillStyle = '#fbbf24'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = icon.type === 'capital' ? 1.5 : 1
      ctx.beginPath()
      
      if (icon.type === 'stronghold') {
        // 圆点
        ctx.arc(centerX, centerY, this.tileSize * 0.15, 0, Math.PI * 2)
      } else if (icon.type === 'capital') {
        // 星形
        const radius = this.tileSize * 0.2
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI / 5) - Math.PI / 2
          const x1 = centerX + radius * Math.cos(angle)
          const y1 = centerY + radius * Math.sin(angle)
          
          if (i === 0) {
            ctx.moveTo(x1, y1)
          } else {
            ctx.lineTo(x1, y1)
          }
          
          const innerAngle = angle + (2 * Math.PI / 5)
          const x2 = centerX + radius * 0.4 * Math.cos(innerAngle)
          const y2 = centerY + radius * 0.4 * Math.sin(innerAngle)
          ctx.lineTo(x2, y2)
        }
        ctx.closePath()
      }
      
      ctx.fill()
      ctx.stroke()
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

