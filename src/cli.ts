#!/usr/bin/env node

/**
 * 千机阁MCP服务器 - 命令行工具
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './config';
import { createApiClient } from './utils/api-client';
import { createLoggerInstance } from './utils/logger';

const VERSION = require('../package.json').version;

// 设置程序信息
program
  .name('chimech-mcp')
  .description('千机阁企业数字员工平台 MCP 服务器')
  .version(VERSION);

// health 命令 - 健康检查
program
  .command('health')
  .description('检查MCP服务器和API连接状态')
  .action(async () => {
    const spinner = ora('正在检查服务器状态...').start();
    
    try {
      // 加载配置
      const config = await loadConfig();
      const logger = createLoggerInstance(config.logLevel);
      const apiClient = createApiClient(config, logger);
      
      // 测试连接
      spinner.text = '📡 测试API连接...';
      const healthResult = await apiClient.healthCheck();
      
      if (healthResult.status === 'ok') {
        spinner.succeed('✅ 服务器连接正常');
        console.log(chalk.green(`📊 状态: ${healthResult.message}`));
      } else {
        spinner.fail('❌ 服务器连接失败');
        console.log(chalk.red(`❌ 错误: ${healthResult.message}`));
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail('❌ 健康检查失败');
      console.log(chalk.red(`错误详情: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// status 命令 - 显示服务器状态
program
  .command('status')
  .description('显示MCP服务器详细状态')
  .option('-j, --json', '以JSON格式输出')
  .action(async (options) => {
    const spinner = ora('正在获取服务器状态...').start();
    
    try {
      const config = await loadConfig();
      
      spinner.succeed('📊 服务器状态信息');
      
      if (options.json) {
        console.log(JSON.stringify({
          version: VERSION,
          config: {
            serverUrl: config.serverUrl,
            timeout: config.timeout,
            cacheEnabled: config.cacheEnabled,
            logLevel: config.logLevel
          },
          timestamp: new Date().toISOString()
        }, null, 2));
      } else {
        console.log(chalk.blue('\n📋 千机阁MCP服务器状态'));
        console.log(chalk.gray(''.padEnd(50, '─')));
        console.log(`${chalk.cyan('版本')}: ${VERSION}`);
        console.log(`${chalk.cyan('服务器地址')}: ${config.serverUrl}`);
        console.log(`${chalk.cyan('超时设置')}: ${config.timeout}ms`);
        console.log(`${chalk.cyan('缓存状态')}: ${config.cacheEnabled ? '启用' : '禁用'}`);
        console.log(`${chalk.cyan('日志级别')}: ${config.logLevel}`);
        console.log(`${chalk.cyan('检查时间')}: ${new Date().toLocaleString()}`);
      }
      
    } catch (error) {
      spinner.fail('❌ 状态检查失败');
      console.log(chalk.red(`错误详情: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// version 命令 - 显示版本信息
program
  .command('version')
  .description('显示版本信息')
  .action(() => {
    console.log(chalk.blue('千机阁MCP服务器'));
    console.log(`版本: ${chalk.green(VERSION)}`);
    console.log(`Node.js: ${chalk.green(process.version)}`);
    console.log(`平台: ${chalk.green(process.platform)} ${process.arch}`);
  });

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 