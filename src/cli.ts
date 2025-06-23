#!/usr/bin/env node

/**
 * 千机阁MCP服务器CLI工具
 */

import { program } from 'commander';
import { createLoggerInstance } from '@/utils/logger';
import { loadConfig } from '@/config';
import { ChiMechMCPServer } from '@/server/mcp-server';
import { createApiClient } from '@/utils/api-client';
import { createCacheManager } from '@/utils/cache';
import chalk from 'chalk';
import { version } from '../package.json';

const logger = createLoggerInstance();

/**
 * 显示千机阁LOGO
 */
function showLogo() {
  console.log(chalk.cyan(`
    ╔═══════════════════════════════════════╗
    ║          千机阁 MCP 服务器              ║
    ║      ChiMech MCP Server v${version.padEnd(8)} ║
    ║                                       ║
    ║         https://chimech.com           ║
    ╚═══════════════════════════════════════╝
  `));
}

/**
 * 健康检查命令
 */
async function healthCheck() {
  try {
    showLogo();
    console.log(chalk.blue('🔍 正在进行健康检查...\n'));

    // 加载配置
    const config = loadConfig();
    
    // 创建API客户端
    const apiClient = createApiClient(config);
    
    // 测试连接
    console.log(chalk.yellow('📡 测试API连接...'));
    const healthResult = await apiClient.health();
    
    if (healthResult.success) {
      console.log(chalk.green('✅ API连接正常'));
      console.log(chalk.gray(`   服务器版本: ${healthResult.version}`));
      console.log(chalk.gray(`   响应时间: ${healthResult.latency}ms`));
    } else {
      console.log(chalk.red('❌ API连接失败'));
      console.log(chalk.red(`   错误: ${healthResult.error}`));
      process.exit(1);
    }

    // 测试缓存
    console.log(chalk.yellow('💾 测试缓存系统...'));
    const cache = createCacheManager(config.cacheTtl);
    await cache.set('test-key', 'test-value', 10);
    const cacheValue = await cache.get('test-key');
    
    if (cacheValue === 'test-value') {
      console.log(chalk.green('✅ 缓存系统正常'));
    } else {
      console.log(chalk.yellow('⚠️  缓存系统异常'));
    }

    // 测试工具注册
    console.log(chalk.yellow('🔧 测试工具注册...'));
    const server = new ChiMechMCPServer(config);
    const tools = server.getAvailableTools();
    
    console.log(chalk.green(`✅ 工具系统正常 (${tools.length}个工具)`));
    tools.forEach(tool => {
      console.log(chalk.gray(`   • ${tool.name} - ${tool.description}`));
    });

    console.log(chalk.green('\n🎉 健康检查通过！系统运行正常。'));

  } catch (error) {
    console.log(chalk.red('\n❌ 健康检查失败'));
    console.log(chalk.red(`错误详情: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 状态查看命令
 */
async function showStatus(options: { watch?: boolean; json?: boolean }) {
  try {
    const config = loadConfig();
    const server = new ChiMechMCPServer(config);

    if (options.json) {
      // JSON格式输出
      const status = await server.getStatus();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    // 格式化输出
    const displayStatus = async () => {
      console.clear();
      showLogo();
      
      const status = await server.getStatus();
      
      console.log(chalk.blue('📊 服务器状态\n'));
      
      // 基本信息
      console.log(chalk.yellow('基本信息:'));
      console.log(`  状态: ${status.running ? chalk.green('运行中') : chalk.red('已停止')}`);
      console.log(`  运行时间: ${chalk.cyan(formatUptime(status.uptime))}`);
      console.log(`  版本: ${chalk.cyan(status.version)}`);
      console.log(`  进程ID: ${chalk.cyan(status.pid)}`);
      
      // 性能统计
      console.log(chalk.yellow('\n性能统计:'));
      console.log(`  总请求数: ${chalk.cyan(status.stats.totalRequests)}`);
      console.log(`  成功请求: ${chalk.green(status.stats.successfulRequests)}`);
      console.log(`  失败请求: ${chalk.red(status.stats.failedRequests)}`);
      console.log(`  平均响应时间: ${chalk.cyan(status.stats.averageResponseTime)}ms`);
      
      // 缓存统计
      console.log(chalk.yellow('\n缓存统计:'));
      console.log(`  缓存命中: ${chalk.green(status.cache.hits)}`);
      console.log(`  缓存未命中: ${chalk.yellow(status.cache.misses)}`);
      console.log(`  命中率: ${chalk.cyan((status.cache.hitRate * 100).toFixed(1))}%`);
      
      // 工具信息
      console.log(chalk.yellow('\n已注册工具:'));
      status.tools.forEach(tool => {
        console.log(`  • ${chalk.cyan(tool.name)} - ${tool.description}`);
        console.log(`    调用次数: ${tool.callCount}, 平均耗时: ${tool.averageTime}ms`);
      });

      if (options.watch) {
        console.log(chalk.gray('\n按 Ctrl+C 退出监控模式...'));
      }
    };

    if (options.watch) {
      // 监控模式
      setInterval(displayStatus, 2000);
    }
    
    await displayStatus();

  } catch (error) {
    console.log(chalk.red('❌ 获取状态失败'));
    console.log(chalk.red(`错误详情: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 格式化运行时间
 */
function formatUptime(uptime: number): string {
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟 ${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 导出统计数据
 */
async function exportStats(outputFile: string) {
  try {
    const config = loadConfig();
    const server = new ChiMechMCPServer(config);
    const stats = await server.getDetailedStats();
    
    const fs = await import('fs/promises');
    await fs.writeFile(outputFile, JSON.stringify(stats, null, 2));
    
    console.log(chalk.green(`✅ 统计数据已导出到: ${outputFile}`));
    
  } catch (error) {
    console.log(chalk.red('❌ 导出统计数据失败'));
    console.log(chalk.red(`错误详情: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 配置CLI程序
 */
program
  .name('chimech-mcp')
  .description('千机阁MCP服务器命令行工具')
  .version(version);

// 健康检查命令
program
  .command('health')
  .description('运行健康检查')
  .action(healthCheck);

// 状态查看命令
program
  .command('status')
  .description('查看服务器状态')
  .option('-w, --watch', '持续监控模式')
  .option('-j, --json', 'JSON格式输出')
  .action(showStatus);

// 统计导出命令
program
  .command('stats')
  .description('导出统计数据')
  .option('-o, --output <file>', '输出文件路径', 'stats.json')
  .action((options) => exportStats(options.output));

// 启动服务器命令
program
  .command('start')
  .description('启动MCP服务器')
  .option('-d, --daemon', '后台运行')
  .action(async (options) => {
    if (options.daemon) {
      console.log(chalk.yellow('后台模式启动...'));
      // 这里可以添加后台运行逻辑
    }
    
    // 启动服务器
    const { ChiMechApp } = await import('./index.js');
    const app = new ChiMechApp();
    await app.start();
  });

// 解析命令行参数
program.parse(); 