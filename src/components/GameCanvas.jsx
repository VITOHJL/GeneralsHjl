import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import Renderer from '../game/Renderer'

function GameCanvas({ isPaused = false, gameConfig = null, fastMode = false, onRegisterCameraControls = null }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const { gameState, gameEngine, initGame, makeMove, nextTurn } = useGameStore()
  const [selectedTile, setSelectedTile] = useState(null) // {x, y}
  const [mouseDownTile, setMouseDownTile] = useState(null) // 鼠标按下的格子
  const justDraggedRef = useRef(false) // 标记是否刚刚处理了拖拽
  const lastClickedTileRef = useRef(null) // 最近一次点击的格子

  // 初始化渲染器（只在挂载/卸载时执行）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    rendererRef.current = new Renderer(canvas)

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
    }
  }, [])

  // 根据配置初始化游戏（状态为空且有配置时）
  useEffect(() => {
    if (!gameState && gameConfig) {
      initGame(gameConfig)
    }
  }, [gameState, gameConfig, initGame])

  // 渲染循环：依赖 gameState / selectedTile，但不销毁 renderer
  useEffect(() => {
    if (!rendererRef.current) return

    let animationFrameId = null
    let lastRenderTime = 0
    const FPS = 30
    const frameInterval = 1000 / FPS

    const render = (currentTime) => {
      if (currentTime - lastRenderTime >= frameInterval) {
        if (rendererRef.current && gameState) {
          rendererRef.current.render(gameState, selectedTile)
        }
        lastRenderTime = currentTime
      }
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [gameState, selectedTile])

  // AI自动操作
  useEffect(() => {
    if (!gameState || gameState.gameOver || isPaused || !gameState.isAIPlayer || !gameEngine) return

    const thinkDelay = fastMode ? 0 : 500
    const afterMoveDelay = fastMode ? 0 : 300

    // 如果当前玩家是AI，自动执行AI决策
    const timer = setTimeout(() => {
      const aiDecision = gameEngine.getAIDecision()
      
      if (aiDecision) {
        // AI决定移动
        const success = makeMove(
          aiDecision.fromX,
          aiDecision.fromY,
          aiDecision.toX,
          aiDecision.toY,
          aiDecision.moveType
        )
        if (success) {
          // 移动成功后自动切换到下一个玩家
          setTimeout(() => nextTurn(), afterMoveDelay)
        } else {
          // 移动失败，也切换到下一个玩家（AI可能做了无效决策）
          setTimeout(() => nextTurn(), afterMoveDelay)
        }
      } else {
        // AI决定跳过回合
        nextTurn()
      }
    }, thinkDelay)
    
    return () => clearTimeout(timer)
  }, [gameState?.currentPlayer, gameState?.isAIPlayer, gameState?.gameOver, isPaused, fastMode, gameEngine, makeMove, nextTurn])

  // 获取点击的格子坐标
  const getTileFromEvent = (e) => {
    const canvas = canvasRef.current
    if (!canvas || !gameState?.map || !rendererRef.current) return null

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    return rendererRef.current.screenToTile(x, y, gameState.map)
  }

  // 处理鼠标按下
  const handleMouseDown = (e) => {
    if (!gameState || gameState.gameOver || isPaused) return

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
    
    if (!gameState || gameState.gameOver || isPaused) return

    const tile = getTileFromEvent(e)
    if (!tile) {
      setSelectedTile(null)
      return
    }

    const mapTile = gameState.map.tiles[tile.y][tile.x]
    lastClickedTileRef.current = tile

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

  const handleZoom = (factor) => {
    if (!rendererRef.current || !gameState?.map) return
    const map = gameState.map
    const centerTile = lastClickedTileRef.current || {
      x: Math.floor(map.width / 2),
      y: Math.floor(map.height / 2)
    }
    rendererRef.current.zoomAtTile(centerTile.x, centerTile.y, factor, map)
  }

  const handleResetView = () => {
    if (!rendererRef.current || !gameState?.map) return
    rendererRef.current.resetView(gameState.map)
  }

  useEffect(() => {
    if (!onRegisterCameraControls) return
    const controls = {
      zoomIn: () => handleZoom(1.25),
      zoomOut: () => handleZoom(0.8),
      resetView: () => handleResetView()
    }
    onRegisterCameraControls(controls)
    return () => onRegisterCameraControls(null)
  }, [onRegisterCameraControls, gameState])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer block"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  )
}

export default GameCanvas
