  /**
 * AI基类
 * 所有AI实现都应该继承这个类
 */
class AIBase {
  constructor(playerId, difficulty = 'medium') {
    this.playerId = playerId
    this.difficulty = difficulty
  }

  /**
   * 获取AI的决策
   * @param {Object} gameState - 当前游戏状态
   * @returns {Object|null} 移动决策或null（跳过回合）
   * 返回格式：
   * {
   *   fromX: number,    // 源格子X坐标
   *   fromY: number,    // 源格子Y坐标
   *   toX: number,     // 目标格子X坐标
   *   toY: number,     // 目标格子Y坐标
   *   moveType: 'half' | 'max'  // 移动类型：'half'=50%, 'max'=只留1个
   * }
   * 或 null 表示跳过这回合
   */
  getDecision(gameState) {
    throw new Error('getDecision method must be implemented by subclass')
  }

  /**
   * 获取AI的名称
   */
  getName() {
    return `${this.constructor.name} (${this.difficulty})`
  }
}

export default AIBase

