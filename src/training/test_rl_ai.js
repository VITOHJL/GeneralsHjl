#!/usr/bin/env node

/**
 * 测试 RL AI 是否能正确加载 Q 表
 */
import { createAI, AI_TYPES } from '../game/ai/index.js'

import fs from 'fs'

async function test() {
  console.log('测试 StrategyRLAI 加载 Q 表...\n')
  
  // 先检查文件是否存在
  const qTablePath = './qtable-1v3-seq4.json'
  if (fs.existsSync(qTablePath)) {
    const fileSize = fs.statSync(qTablePath).size
    console.log(`✓ Q 表文件存在: ${qTablePath} (${fileSize} bytes)`)
  } else {
    console.log(`✗ Q 表文件不存在: ${qTablePath}`)
  }
  
  // 测试1: 不指定 Q 表（应该用空表）
  const ai1 = createAI(AI_TYPES.STRATEGY_RL, 1, {})
  console.log('✓ StrategyRLAI 创建成功（空 Q 表）')
  
  // 测试2: 指定 Q 表文件路径
  const ai2 = createAI(AI_TYPES.STRATEGY_RL, 1, {
    qTablePath: qTablePath
  })
  console.log('✓ StrategyRLAI 创建成功（加载 Q 表）')
  const qStats = ai2.getQTableStats()
  console.log(`  Q 表大小: ${qStats.size}`)
  if (qStats.size > 0) {
    console.log(`  Q 值范围: [${qStats.minQ.toFixed(2)}, ${qStats.maxQ.toFixed(2)}]`)
  }
  
  // 测试3: QLearningAI
  const ai3 = createAI(AI_TYPES.QLEARNING_RL, 2, {
    qTablePath: qTablePath
  })
  console.log('\n✓ QLearningAI 创建成功（加载 Q 表）')
  const qStats3 = ai3.getQTableStats()
  console.log(`  Q 表大小: ${qStats3.size}`)
  
  console.log('\n所有测试完成！')
}

test().catch(console.error)
