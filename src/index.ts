#!/usr/bin/env node

/**
 * 千机阁MCP服务器主入口
 */

import { ChiMechMCPServer } from '@/server/mcp-server';
import { loadConfig, validateConfig } from '@/config';
import { createApiClient } from '@/utils/api-client';
import { createCacheManager, CacheWarmer } from '@/utils/cache';
import { createLoggerInstance } from '@/utils/logger';
import { toolRegistry } from '@/tools';
import { ChiMechError } from '@/types';

/**
 * 千机阁MCP应用类
 */
class ChiMechApp {
  private server?: ChiMechMCPServer;
  private logger = createLoggerInstance();

  /**
   * 启动应用
   */
  async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting ChiMech MCP Server');

      // 1. 加载配置
      this.logger.info('📋 Loading configuration...');
      const config = loadConfig();
      validateConfig(config);
      this.logger.info('✅ Configuration loaded successfully');

      // 更新日志器配置
      this.logger = createLoggerInstance(
        config.logLevel,
        process.env.LOG_FILE,
        process.env.NODE_ENV !== 'test'
      );

      // 2. 创建组件
      this.logger.info('🔧 Initializing components...');
      
      const apiClient = createApiClient(config, this.logger);
      const cache = createCacheManager(config.cacheEnabled, config.cacheTtl);
      
      this.logger.info('✅ Components initialized');

      // 3. 创建MCP服务器
      this.logger.info('🏗️  Creating MCP server...');
      this.server = new ChiMechMCPServer(config, apiClient, cache, this.logger);
      
      // 注册所有工具
      const tools = toolRegistry.getAll();
      this.server.registerTools(tools);
      
      this.logger.info('✅ MCP server created', {
        toolCount: tools.length,
        categories: toolRegistry.getCategories().length
      });

      // 4. 预热缓存
      if (config.cacheEnabled) {
        this.logger.info('🔥 Warming up cache...');
        const warmer = new CacheWarmer(cache);
        await warmer.warmUp(apiClient);
        this.logger.info('✅ Cache warmed up');
      }

      // 5. 启动服务器
      this.logger.info('🌟 Starting MCP server...');
      await this.server.start();
      
      this.logger.info('🎉 ChiMech MCP Server started successfully!', {
        serverUrl: config.serverUrl,
        clientType: config.clientType,
        tools: tools.map(t => t.name),
        features: {
          cache: config.cacheEnabled,
          retry: config.retryCount > 0,
          timeout: config.timeout
        }
      });

      // 设置优雅关闭
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('💥 Failed to start ChiMech MCP Server', error as Error);
      
      if (error instanceof ChiMechError) {
        this.logger.error(`Error Code: ${error.code}`, undefined, {
          statusCode: error.statusCode,
          details: error.details
        });
      }
      
      process.exit(1);
    }
  }

  /**
   * 停止应用
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('🛑 Stopping ChiMech MCP Server...');
      
      if (this.server) {
        await this.server.stop();
      }
      
      this.logger.info('✅ ChiMech MCP Server stopped gracefully');
    } catch (error) {
      this.logger.error('💥 Error during shutdown', error as Error);
      process.exit(1);
    }
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`📡 Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    // 监听退出信号
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // 监听未捕获的异常
    process.on('uncaughtException', (error) => {
      this.logger.error('💥 Uncaught Exception', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('💥 Unhandled Rejection', new Error(String(reason)), {
        promise: promise.toString()
      });
      process.exit(1);
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<void> {
    if (!this.server) {
      throw new Error('Server not initialized');
    }
    
    const health = await this.server.healthCheck();
    console.log(JSON.stringify(health, null, 2));
  }

  /**
   * 显示服务器状态
   */
  async status(): Promise<void> {
    if (!this.server) {
      throw new Error('Server not initialized');
    }
    
    const stats = this.server.getStats();
    const toolStats = toolRegistry.getStats();
    
    console.log('📊 ChiMech MCP Server Status:');
    console.log('================================');
    console.log(`🕐 Uptime: ${Math.round(stats.uptime / 1000)}s`);
    console.log(`📈 Total Requests: ${stats.totalRequests}`);
    console.log(`✅ Success Rate: ${stats.successRate}%`);
    console.log(`🔧 Tools: ${stats.toolCount}`);
    console.log(`📂 Categories: ${toolStats.categories}`);
    
    if (stats.topTools.length > 0) {
      console.log('\n🏆 Top Tools:');
      stats.topTools.forEach((tool, index) => {
        console.log(`${index + 1}. ${tool.name}: ${tool.count} calls`);
      });
    }
  }
}

/**
 * CLI处理
 */
async function main() {
  const app = new ChiMechApp();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'health':
      await app.healthCheck();
      break;
      
    case 'status':
      await app.status();
      break;
      
    case 'start':
    default:
      await app.start();
      break;
  }
}

// 仅在直接运行时执行
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Application error:', error);
    process.exit(1);
  });
}

// 导出应用类供测试使用
export { ChiMechApp };
export default ChiMechApp; 