import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import Renderer from '../game/Renderer'

function GameCanvas() {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const { gameState, initGame, makeMove, nextTurn } = useGameStore()
  const [selectedTile, setSelectedTile] = useState(null) // {x, y}
  const [mouseDownTile, setMouseDownTile] = useState(null) // 鼠标按下的格子
  const justDraggedRef = useRef(false) // 标记是否刚刚处理了拖拽

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 初始化渲染器
    rendererRef.current = new Renderer(canvas)
    
    // 初始化游戏
    if (!gameState) {
      initGame({
        width: 25,
        height: 25,
        players: 2
      })
    }

    // 渲染循环
    const render = () => {
      if (rendererRef.current && gameState) {
        rendererRef.current.render(gameState, selectedTile)
      }
      requestAnimationFrame(render)
    }
    render()

    // 清理
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy()
      }
    }
  }, [gameState, initGame, selectedTile])

  // 获取点击的格子坐标
  const getTileFromEvent = (e) => {
    const canvas = canvasRef.current
    if (!canvas || !gameState?.map) return null

    const rect = canvas.getBoundingClientRect()
    const canvasWidth = rect.width
    const canvasHeight = rect.height
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const tileSize = Math.min(
      canvasWidth / gameState.map.width,
      canvasHeight / gameState.map.height
    )
    const offsetX = (canvasWidth - gameState.map.width * tileSize) / 2
    const offsetY = (canvasHeight - gameState.map.height * tileSize) / 2

    const tileX = Math.floor((x - offsetX) / tileSize)
    const tileY = Math.floor((y - offsetY) / tileSize)

    if (tileX >= 0 && tileX < gameState.map.width && 
        tileY >= 0 && tileY < gameState.map.height) {
      return { x: tileX, y: tileY }
    }
    return null
  }

  // 处理鼠标按下
  const handleMouseDown = (e) => {
    if (!gameState || gameState.gameOver) return

    const tile = getTileFromEvent(e)
    if (tile) {
      const mapTile = gameState.map.tiles[tile.y][tile.x]
      // 只有己方格子且单位数>=2才能作为起始点
      if (mapTile.owner === gameState.currentPlayer && mapTile.units >= 2) {
        setMouseDownTile(tile)
      }
    }
  }

  // 处理鼠标松开
  const handleMouseUp = (e) => {
    justDraggedRef.current = false
    
    if (!gameState || gameState.gameOver || !mouseDownTile) {
      setMouseDownTile(null)
      return
    }

    const tile = getTileFromEvent(e)
    
    // 如果鼠标松开在另一个格子上，说明是拖拽
    if (tile && (mouseDownTile.x !== tile.x || mouseDownTile.y !== tile.y)) {
      // 拖拽：只保留1个，其余全部移动
      justDraggedRef.current = true
      const success = makeMove(
        mouseDownTile.x, 
        mouseDownTile.y, 
        tile.x, 
        tile.y, 
        'max'
      )
      if (success) {
        setSelectedTile(null)
        // 移动后自动切换到下一个玩家
        setTimeout(() => nextTurn(), 100)
      }
    }
    // 如果鼠标松开在同一个格子上，说明是点击，由onClick处理
    
    setMouseDownTile(null)
  }

  // 处理点击（只在鼠标按下和松开在同一个格子时触发）
  const handleClick = (e) => {
    // 如果刚刚处理了拖拽，忽略点击
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    
    if (!gameState || gameState.gameOver) return

    const tile = getTileFromEvent(e)
    if (!tile) {
      setSelectedTile(null)
      return
    }

    const mapTile = gameState.map.tiles[tile.y][tile.x]

    // 如果已经选中了格子，执行移动（50%）
    if (selectedTile && 
        (selectedTile.x !== tile.x || selectedTile.y !== tile.y)) {
      const success = makeMove(
        selectedTile.x, 
        selectedTile.y, 
        tile.x, 
        tile.y, 
        'half'
      )
      if (success) {
        setSelectedTile(null)
        // 移动后自动切换到下一个玩家
        setTimeout(() => nextTurn(), 100)
      } else {
        setSelectedTile(null)
      }
    } else {
      // 选中新格子
      if (mapTile.owner === gameState.currentPlayer && mapTile.units >= 2) {
        setSelectedTile(tile)
      } else {
        setSelectedTile(null)
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      style={{ 
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    />
  )
}

export default GameCanvas
