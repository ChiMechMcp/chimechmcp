/**
 * 千机阁MCP服务器核心实现
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import type { 
  ChiMechConfig, 
  ChiMechTool, 
  ToolContext, 
  Logger,
  CacheManager,
  ChiMechApiClient
} from '@/types';
import { ChiMechError } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 千机阁MCP服务器主类
 */
export class ChiMechMCPServer {
  private server: Server;
  private tools: Map<string, ChiMechTool> = new Map();
  private apiClient: ChiMechApiClient;
  private cache: CacheManager;
  private startTime: number = Date.now();
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    toolCalls: new Map<string, number>()
  };

  constructor(
    private config: ChiMechConfig,
    apiClient: ChiMechApiClient,
    cache: CacheManager,
    private serverLogger: Logger = logger
  ) {
    this.apiClient = apiClient;
    this.cache = cache;
    
    // 初始化MCP服务器
    this.server = new Server({
      name: 'chimech-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  /**
   * 设置MCP协议处理器
   */
  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.serverLogger.debug('[MCP] Listing tools', { 
        toolCount: this.tools.size 
      });

      return {
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: this.zodSchemaToJsonSchema(tool.schema),
            required: this.getRequiredFields(tool.schema)
          }
        }))
      };
    });

    // 调用工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      const requestId = randomUUID();
      
      this.stats.totalRequests++;
      
      this.serverLogger.info(`[MCP] Tool call: ${request.params.name}`, {
        requestId,
        toolName: request.params.name,
        arguments: request.params.arguments
      });

      try {
        const tool = this.tools.get(request.params.name);
        if (!tool) {
          throw new ChiMechError(
            `Unknown tool: ${request.params.name}`,
            'UNKNOWN_TOOL',
            404
          );
        }

        // 更新工具调用统计
        const currentCount = this.stats.toolCalls.get(request.params.name) || 0;
        this.stats.toolCalls.set(request.params.name, currentCount + 1);

        // 验证参数
        const validatedArgs = tool.schema.parse(request.params.arguments);

        // 创建工具上下文
        const context: ToolContext = {
          requestId,
          clientType: this.config.clientType,
          workspaceId: this.config.workspaceId,
          teamId: this.config.teamId,
          apiClient: this.apiClient,
          cache: this.cache,
          logger: this.serverLogger
        };

        // 执行工具
        const result = await tool.handler(validatedArgs, context);
        
        const duration = Date.now() - startTime;
        this.stats.successfulRequests++;
        
        this.serverLogger.info(`[MCP] Tool call completed: ${request.params.name}`, {
          requestId,
          duration,
          success: true
        });

        return {
          content: result.content,
          isError: false
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        this.stats.failedRequests++;
        
        this.serverLogger.error(`[MCP] Tool call failed: ${request.params.name}`, error as Error, {
          requestId,
          duration,
          success: false
        });

        if (error instanceof z.ZodError) {
          return {
            content: [{
              type: 'text',
              text: `参数验证失败: ${error.issues.map(i => i.message).join(', ')}`
            }],
            isError: true
          };
        }

        if (error instanceof ChiMechError) {
          return {
            content: [{
              type: 'text',
              text: `错误 [${error.code}]: ${error.message}`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: `内部错误: ${error instanceof Error ? error.message : '未知错误'}`
          }],
          isError: true
        };
      }
    });
  }

  /**
   * 注册工具
   */
  registerTool(tool: ChiMechTool): void {
    this.tools.set(tool.name, tool);
    this.serverLogger.info(`[MCP] Registered tool: ${tool.name}`, {
      description: tool.description,
      category: tool.metadata?.category
    });
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: ChiMechTool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * 移除工具
   */
  unregisterTool(name: string): boolean {
    const success = this.tools.delete(name);
    if (success) {
      this.serverLogger.info(`[MCP] Unregistered tool: ${name}`);
    }
    return success;
  }

  /**
   * 获取工具列表
   */
  getTools(): ChiMechTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    this.serverLogger.info('[MCP] Starting ChiMech MCP Server', {
      toolCount: this.tools.size,
      config: {
        serverUrl: this.config.serverUrl,
        clientType: this.config.clientType,
        cacheEnabled: this.config.cacheEnabled
      }
    });

    // 验证API连接
    try {
      await this.apiClient.healthCheck();
      this.serverLogger.info('[MCP] API connection verified');
    } catch (error) {
      this.serverLogger.error('[MCP] API connection failed', error as Error);
      throw new ChiMechError(
        'Failed to connect to ChiMech API',
        'API_CONNECTION_FAILED',
        503
      );
    }

    // 启动传输层
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.serverLogger.info('[MCP] Server started successfully');
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    this.serverLogger.info('[MCP] Stopping ChiMech MCP Server');
    await this.server.close();
    this.serverLogger.info('[MCP] Server stopped');
  }

  /**
   * 获取服务器统计信息
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
      : 0;

    return {
      uptime,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      toolCount: this.tools.size,
      topTools: Array.from(this.stats.toolCalls.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; details: any }> {
    try {
      // 检查API连接
      const apiHealth = await this.apiClient.healthCheck();
      
      // 检查缓存
      const cacheWorking = await this.testCache();
      
      const stats = this.getStats();
      
      return {
        status: 'ok',
        details: {
          api: apiHealth,
          cache: { working: cacheWorking },
          server: stats,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 测试缓存功能
   */
  private async testCache(): Promise<boolean> {
    try {
      const testKey = 'health-check-test';
      const testValue = 'ok';
      
      await this.cache.set(testKey, testValue, 5);
      const retrieved = await this.cache.get(testKey);
      await this.cache.delete(testKey);
      
      return retrieved === testValue;
    } catch {
      return false;
    }
  }

  /**
   * 将Zod schema转换为JSON Schema
   */
  private zodSchemaToJsonSchema(schema: z.ZodSchema): any {
    // 简化版转换，实际项目中应使用专门的库
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: any = {};
      
      for (const [key, value] of Object.entries(shape)) {
        if (value instanceof z.ZodString) {
          properties[key] = { type: 'string' };
        } else if (value instanceof z.ZodNumber) {
          properties[key] = { type: 'number' };
        } else if (value instanceof z.ZodBoolean) {
          properties[key] = { type: 'boolean' };
        } else if (value instanceof z.ZodArray) {
          properties[key] = { type: 'array' };
        } else {
          properties[key] = { type: 'object' };
        }
      }
      
      return properties;
    }
    
    return {};
  }

  /**
   * 获取必需字段
   */
  private getRequiredFields(schema: z.ZodSchema): string[] {
    if (schema instanceof z.ZodObject) {
      return Object.keys(schema.shape).filter(key => {
        const field = schema.shape[key];
        return !(field instanceof z.ZodOptional);
      });
    }
    return [];
  }
} 