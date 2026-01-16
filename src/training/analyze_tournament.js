#!/usr/bin/env node

/**
 * 分析锦标赛结果脚本
 * 读取 tournament_results.json 并显示统计结果
 * 避免栈溢出问题，使用安全的循环计算
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const JSON_FILE = './tournament_results.json'

/**
 * 安全地计算思考时间统计（避免栈溢出）
 */
function calculateThinkTimeStats(thinkTimes) {
  if (!thinkTimes || !Array.isArray(thinkTimes) || thinkTimes.length === 0) {
    return { average: 0, min: 0, max: 0, count: 0 }
  }
  
  let sum = 0
  let min = thinkTimes[0]
  let max = thinkTimes[0]
  
  for (let i = 0; i < thinkTimes.length; i++) {
    const time = thinkTimes[i]
    sum += time
    if (time < min) min = time
    if (time > max) max = time
  }
  
  return {
    average: sum / thinkTimes.length,
    min: min,
    max: max,
    count: thinkTimes.length
  }
}

/**
 * 分析锦标赛结果
 */
async function analyzeTournament() {
  console.log('='.repeat(80))
  console.log('分析锦标赛结果')
  console.log('='.repeat(80))
  
  // 读取JSON文件
  let data
  try {
    const filePath = join(process.cwd(), JSON_FILE)
    const fileContent = readFileSync(filePath, 'utf-8')
    data = JSON.parse(fileContent)
    console.log(`已加载文件: ${JSON_FILE}`)
    console.log(`时间戳: ${data.timestamp}`)
    console.log(`配置: ${data.config.gamesPerMap} 局/地图, ${data.config.mapSizes.length} 种地图尺寸`)
    console.log()
  } catch (error) {
    console.error(`错误: 无法读取文件 ${JSON_FILE}: ${error.message}`)
    process.exit(1)
  }
  
  const { results, overall, config } = data
  const mapSizes = config.mapSizes.map(m => m.name)
  const aiNames = config.aiConfigs.map(c => c.name)
  
  // 按地图尺寸输出
  for (const mapSize of mapSizes) {
    console.log(`\n${mapSize} 地图:`)
    console.log('-'.repeat(120))
    
    // 收集并计算统计
    const aiStats = []
    for (const aiName of aiNames) {
      const stats = results[mapSize][aiName]
      if (!stats) continue
      
      // 从 thinkTime.all 重新计算统计（如果存在）
      let thinkTimeStats = stats.thinkTime || {}
      if (stats.thinkTime && stats.thinkTime.all && Array.isArray(stats.thinkTime.all)) {
        thinkTimeStats = calculateThinkTimeStats(stats.thinkTime.all)
      }
      
      aiStats.push({
        name: aiName,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        draws: stats.draws || 0,
        timeouts: stats.timeouts || 0,
        total: stats.total || 0,
        winRate: stats.winRate || 0,
        avgThinkTime: thinkTimeStats.average || 0,
        minThinkTime: thinkTimeStats.min || 0,
        maxThinkTime: thinkTimeStats.max || 0,
        thinkCount: thinkTimeStats.count || 0
      })
    }
    
    // 按胜率排序
    aiStats.sort((a, b) => b.winRate - a.winRate)
    
    // 输出表格
    console.log(`${'AI名称'.padEnd(15)} ${'胜场'.padEnd(8)} ${'负场'.padEnd(8)} ${'平局'.padEnd(8)} ${'超时'.padEnd(8)} ${'总场次'.padEnd(8)} ${'胜率'.padEnd(10)} ${'平均思考(ms)'.padEnd(15)} ${'最小(ms)'.padEnd(10)} ${'最大(ms)'.padEnd(10)}`)
    console.log('-'.repeat(120))
    
    for (const stat of aiStats) {
      console.log(
        `${stat.name.padEnd(15)} ` +
        `${stat.wins.toString().padEnd(8)} ` +
        `${stat.losses.toString().padEnd(8)} ` +
        `${stat.draws.toString().padEnd(8)} ` +
        `${stat.timeouts.toString().padEnd(8)} ` +
        `${stat.total.toString().padEnd(8)} ` +
        `${stat.winRate.toFixed(2)}%`.padEnd(10) +
        `${stat.thinkCount > 0 ? stat.avgThinkTime.toFixed(2) : 'N/A'}`.padEnd(15) +
        `${stat.thinkCount > 0 ? stat.minThinkTime.toFixed(2) : 'N/A'}`.padEnd(10) +
        `${stat.thinkCount > 0 ? stat.maxThinkTime.toFixed(2) : 'N/A'}`
      )
    }
  }
  
  // 汇总统计（所有地图）
  console.log('\n' + '='.repeat(80))
  console.log('汇总统计（所有地图）:')
  console.log('='.repeat(80))
  
  const overallStats = []
  for (const aiName of aiNames) {
    const stats = overall[aiName]
    if (!stats) continue
    
    // 从所有地图收集思考时间数据
    const allThinkTimes = []
    for (const mapSize of mapSizes) {
      const mapStats = results[mapSize][aiName]
      if (mapStats && mapStats.thinkTime && mapStats.thinkTime.all && Array.isArray(mapStats.thinkTime.all)) {
        allThinkTimes.push(...mapStats.thinkTime.all)
      }
    }
    
    // 计算汇总统计
    const thinkTimeStats = calculateThinkTimeStats(allThinkTimes)
    
    overallStats.push({
      name: aiName,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      draws: stats.draws || 0,
      timeouts: stats.timeouts || 0,
      total: stats.total || 0,
      winRate: stats.winRate || 0,
      avgThinkTime: thinkTimeStats.average,
      minThinkTime: thinkTimeStats.min,
      maxThinkTime: thinkTimeStats.max,
      thinkCount: thinkTimeStats.count
    })
  }
  
  // 按胜率排序
  overallStats.sort((a, b) => b.winRate - a.winRate)
  
  // 输出表格
  console.log(`${'AI名称'.padEnd(15)} ${'胜场'.padEnd(8)} ${'负场'.padEnd(8)} ${'平局'.padEnd(8)} ${'超时'.padEnd(8)} ${'总场次'.padEnd(8)} ${'胜率'.padEnd(10)} ${'平均思考(ms)'.padEnd(15)} ${'最小(ms)'.padEnd(10)} ${'最大(ms)'.padEnd(10)}`)
  console.log('-'.repeat(120))
  
  for (const stat of overallStats) {
    console.log(
      `${stat.name.padEnd(15)} ` +
      `${stat.wins.toString().padEnd(8)} ` +
      `${stat.losses.toString().padEnd(8)} ` +
      `${stat.draws.toString().padEnd(8)} ` +
      `${stat.timeouts.toString().padEnd(8)} ` +
      `${stat.total.toString().padEnd(8)} ` +
      `${stat.winRate.toFixed(2)}%`.padEnd(10) +
      `${stat.thinkCount > 0 ? stat.avgThinkTime.toFixed(2) : 'N/A'}`.padEnd(15) +
      `${stat.thinkCount > 0 ? stat.minThinkTime.toFixed(2) : 'N/A'}`.padEnd(10) +
      `${stat.thinkCount > 0 ? stat.maxThinkTime.toFixed(2) : 'N/A'}`
    )
  }
  
  console.log('='.repeat(80))
  
  // 可选：保存清理后的版本（不包含 all 数组）
  if (process.argv.includes('--save-clean')) {
    const fs = await import('fs/promises')
    const cleanData = {
      timestamp: data.timestamp,
      config: data.config,
      results: {},
      overall: {}
    }
    
    // 清理 results
    for (const mapSize of mapSizes) {
      cleanData.results[mapSize] = {}
      for (const aiName of aiNames) {
        const stats = results[mapSize][aiName]
        if (!stats) continue
        
        const thinkTimeStats = stats.thinkTime && stats.thinkTime.all
          ? calculateThinkTimeStats(stats.thinkTime.all)
          : (stats.thinkTime || { average: 0, min: 0, max: 0, count: 0 })
        
        cleanData.results[mapSize][aiName] = {
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          timeouts: stats.timeouts,
          total: stats.total,
          winRate: stats.winRate,
          thinkTime: {
            average: thinkTimeStats.average,
            min: thinkTimeStats.min,
            max: thinkTimeStats.max,
            count: thinkTimeStats.count
          }
        }
      }
    }
    
    // 清理 overall
    for (const aiName of aiNames) {
      const stats = overall[aiName]
      if (!stats) continue
      
      const allThinkTimes = []
      for (const mapSize of mapSizes) {
        const mapStats = results[mapSize][aiName]
        if (mapStats && mapStats.thinkTime && mapStats.thinkTime.all) {
          allThinkTimes.push(...mapStats.thinkTime.all)
        }
      }
      
      const thinkTimeStats = calculateThinkTimeStats(allThinkTimes)
      
      cleanData.overall[aiName] = {
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        timeouts: stats.timeouts,
        total: stats.total,
        winRate: stats.winRate,
        thinkTime: {
          average: thinkTimeStats.average,
          min: thinkTimeStats.min,
          max: thinkTimeStats.max,
          count: thinkTimeStats.count
        }
      }
    }
    
    const cleanPath = './tournament_results_clean.json'
    await fs.writeFile(cleanPath, JSON.stringify(cleanData, null, 2), 'utf-8')
    console.log(`\n清理后的结果已保存到: ${cleanPath}`)
    console.log(`(已移除所有思考时间数组，只保留统计信息)`)
  }
}

// 运行分析
analyzeTournament().catch(error => {
  console.error('错误:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})
