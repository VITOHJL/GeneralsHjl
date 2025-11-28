// Canvas渲染器
import strongholdTexture from '../assets/tiles/stronghold.png'
import capitalTexture from '../assets/tiles/capital.png'
import obstacleTexture from '../assets/tiles/obstacle.png'
import { getPlayerColor } from '../utils/colors'

const TILE_TEXTURE_FILES = {
  stronghold: strongholdTexture,
  capital: capitalTexture,
  obstacle: obstacleTexture
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.dpr = window.devicePixelRatio || 1
    this.setupCanvas()
    
    // 缓存上次渲染状态
    this.lastGameState = null
    this.lastSelectedTile = null
    this.dirtyTiles = new Set() // 需要重绘的格子 {x-y}
    this.canvasWidth = 0
    this.canvasHeight = 0
    this.baseTileSize = 0 // 基础格子大小（未缩放）
    this.tileSize = 0     // 实际绘制用的格子大小（包含缩放）
    this.offsetX = 0
    this.offsetY = 0
    this.zoom = 1
    this.minZoom = 0.5
    this.maxZoom = 2.5
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
      const dpr = window.devicePixelRatio || 1
      this.dpr = dpr
      this.canvasWidth = rect.width
      this.canvasHeight = rect.height
      this.canvas.style.width = `${rect.width}px`
      this.canvas.style.height = `${rect.height}px`
      this.canvas.width = rect.width * dpr
      this.canvas.height = rect.height * dpr
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      
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
   * 计算布局参数（基础格子大小），缩放和平移由 zoom/offset 控制
   */
  calculateLayout(map) {
    this.baseTileSize = Math.min(
      this.canvasWidth / map.width,
      this.canvasHeight / map.height
    )
    // 初始化 tileSize 和 offset，只在初次或重置视图时使用
    if (!this.tileSize) {
      this.tileSize = this.baseTileSize * this.zoom
      this.offsetX = (this.canvasWidth - map.width * this.tileSize) / 2
      this.offsetY = (this.canvasHeight - map.height * this.tileSize) / 2
    }
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
   * 将屏幕坐标转换为格子坐标
   */
  screenToTile(screenX, screenY, map) {
    const targetMap = map || this.lastGameState?.map
    if (!targetMap || !this.tileSize) return null
    const tileX = Math.floor((screenX - this.offsetX) / this.tileSize)
    const tileY = Math.floor((screenY - this.offsetY) / this.tileSize)
    if (tileX < 0 || tileX >= targetMap.width || tileY < 0 || tileY >= targetMap.height) {
      return null
    }
    return { x: tileX, y: tileY }
  }

  /**
   * 以某个格子为中心缩放
   */
  zoomAtTile(tileX, tileY, factor, map) {
    const targetMap = map || this.lastGameState?.map
    if (!targetMap || !this.baseTileSize) return

    const oldZoom = this.zoom
    let newZoom = oldZoom * factor
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom))
    if (Math.abs(newZoom - oldZoom) < 0.001) return

    const oldTileSize = this.tileSize || this.baseTileSize * oldZoom
    const centerWorldX = this.offsetX + (tileX + 0.5) * oldTileSize
    const centerWorldY = this.offsetY + (tileY + 0.5) * oldTileSize

    this.zoom = newZoom
    this.tileSize = this.baseTileSize * this.zoom

    this.offsetX = centerWorldX - (tileX + 0.5) * this.tileSize
    this.offsetY = centerWorldY - (tileY + 0.5) * this.tileSize

    this.markAllDirty(targetMap)
  }

  /**
   * 重置视图
   */
  resetView(map) {
    const targetMap = map || this.lastGameState?.map
    if (!targetMap) return
    this.zoom = 1
    this.tileSize = 0 // 让 calculateLayout 重新初始化
    this.calculateLayout(targetMap)
    this.markAllDirty(targetMap)
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
      const dpr = window.devicePixelRatio || 1
      this.dpr = dpr
      this.canvasWidth = rect.width
      this.canvasHeight = rect.height
      this.canvas.style.width = `${rect.width}px`
      this.canvas.style.height = `${rect.height}px`
      this.canvas.width = rect.width * dpr
      this.canvas.height = rect.height * dpr
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      this.calculateLayout(map)
      this.markAllDirty(map)
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

    // 如果当前是整图重绘（所有格子都在脏区域），先清空整个画布，避免缩放/平移后残留
    const isFullRedraw = this.dirtyTiles.size === map.width * map.height
    if (isFullRedraw) {
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    }

    // 用背景色填充脏区域
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

      // 确定背景颜色：中立 / 山区 / 每个玩家固定颜色
      let bgColor = '#374151'
      if (tile.type === 1) { // 山区
        bgColor = '#4b5563'
      } else if (tile.owner === 0) { // 中立
        bgColor = '#6b7280'
      } else { // 玩家格子：按玩家ID给固定颜色
        bgColor = getPlayerColor(tile.owner)
      }

      // 收集背景
      backgrounds.push({ x: px, y: py, color: bgColor })

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

      // 收集边框：当前玩家格子强烈高亮
      if (tile.owner === currentPlayer) {
        borders.push({ x: px, y: py, color: '#facc15', width: 4 }) // 明亮黄色粗边
      }
      if (isSelected) {
        borders.push({ x: px, y: py, color: '#fbbf24', width: 3 })
      }
      borders.push({ x: px, y: py, color: '#1f2937', width: 1 })

      // 收集文字：单位数 + 要塞占领人口成本
      if (tile.owner !== 0 && tile.type !== 1 && tile.units > 0) {
        texts.push({
          x: px + this.tileSize / 2,
          y: py + this.tileSize / 2,
          text: tile.units.toString(),
          fontSize: Math.max(12, this.tileSize * 0.35),
          color: '#ffffff'
        })
      }

      // 要塞占领人口成本文字（仅在未被占领时显示）
      if (tile.type === 2 && tile.owner === 0 && typeof tile.captureCost === 'number' && tile.captureCost > 0) {
        texts.push({
          x: px + this.tileSize / 2,
          y: py + this.tileSize /2,
          text: tile.captureCost.toString(),
          fontSize: Math.max(10, this.tileSize * 0.3),
          color: '#facc15'
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
        ctx.fillStyle = text.color || '#ffffff'
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
    // 背景颜色：与 renderBatch 保持一致
    let bgColor = '#374151'
    if (tile.type === 1) { // 山区
      bgColor = '#4b5563'
    } else if (tile.owner === 0) { // 中立
      bgColor = '#6b7280'
    } else {
      bgColor = getPlayerColor(tile.owner)
    }

    // 绘制格子
    ctx.fillStyle = bgColor
    ctx.fillRect(x, y, size, size)

    // 当前玩家格子的强高亮外圈
    if (tile.owner === currentPlayer) {
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 4
      ctx.strokeRect(x, y, size, size)
    }

    // 如果被选中，绘制更亮的高亮边框
    if (isSelected) {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
    }

    // 底层深色边框
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

