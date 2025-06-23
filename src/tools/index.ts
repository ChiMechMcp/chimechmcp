/**
 * 千机阁MCP工具注册中心
 */

import type { ChiMechTool } from '@/types';
import { chimechAskTool } from './chimech-ask';
import { logger } from '@/utils/logger';

/**
 * 工具注册表
 */
export class ToolRegistry {
  private tools: Map<string, ChiMechTool> = new Map();
  private categories: Map<string, string[]> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * 注册默认工具
   */
  private registerDefaultTools(): void {
    this.register(chimechAskTool);
    
    logger.info('[Registry] Default tools registered', {
      count: this.tools.size,
      tools: Array.from(this.tools.keys())
    });
  }

  /**
   * 注册工具
   */
  register(tool: ChiMechTool): void {
    // 验证工具定义
    this.validateTool(tool);
    
    // 注册工具
    this.tools.set(tool.name, tool);
    
    // 分类管理
    const category = tool.metadata?.category || 'uncategorized';
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category)!.push(tool.name);
    
    logger.info('[Registry] Tool registered', {
      name: tool.name,
      category,
      version: tool.metadata?.version
    });
  }

  /**
   * 批量注册工具
   */
  registerMany(tools: ChiMechTool[]): void {
    tools.forEach(tool => this.register(tool));
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);
    
    // 从分类中移除
    const category = tool.metadata?.category || 'uncategorized';
    const categoryTools = this.categories.get(category);
    if (categoryTools) {
      const index = categoryTools.indexOf(name);
      if (index > -1) {
        categoryTools.splice(index, 1);
      }
      
      // 如果分类为空，删除分类
      if (categoryTools.length === 0) {
        this.categories.delete(category);
      }
    }
    
    logger.info('[Registry] Tool unregistered', { name });
    return true;
  }

  /**
   * 获取工具
   */
  get(name: string): ChiMechTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): ChiMechTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按分类获取工具
   */
  getByCategory(category: string): ChiMechTool[] {
    const toolNames = this.categories.get(category) || [];
    return toolNames.map(name => this.tools.get(name)!).filter(Boolean);
  }

  /**
   * 获取所有分类
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * 搜索工具
   */
  search(query: string): ChiMechTool[] {
    const queryLower = query.toLowerCase();
    
    return this.getAll().filter(tool => {
      // 名称匹配
      if (tool.name.toLowerCase().includes(queryLower)) {
        return true;
      }
      
      // 描述匹配
      if (tool.description.toLowerCase().includes(queryLower)) {
        return true;
      }
      
      // 标签匹配
      if (tool.metadata?.tags?.some(tag => 
        tag.toLowerCase().includes(queryLower)
      )) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * 获取工具统计信息
   */
  getStats() {
    const stats = {
      total: this.tools.size,
      categories: this.categories.size,
      byCategory: {} as Record<string, number>,
      byAuthor: {} as Record<string, number>,
      requireAuth: 0,
      rateLimited: 0
    };

    // 按分类统计
    for (const [category, tools] of this.categories) {
      stats.byCategory[category] = tools.length;
    }

    // 详细统计
    for (const tool of this.tools.values()) {
      // 按作者统计
      const author = tool.metadata?.author || 'unknown';
      stats.byAuthor[author] = (stats.byAuthor[author] || 0) + 1;
      
      // 权限统计
      if (tool.metadata?.requiresAuth) {
        stats.requireAuth++;
      }
      
      if (tool.metadata?.rateLimited) {
        stats.rateLimited++;
      }
    }

    return stats;
  }

  /**
   * 验证工具定义
   */
  private validateTool(tool: ChiMechTool): void {
    if (!tool.name) {
      throw new Error('Tool name is required');
    }
    
    if (!tool.description) {
      throw new Error('Tool description is required');
    }
    
    if (!tool.schema) {
      throw new Error('Tool schema is required');
    }
    
    if (!tool.handler) {
      throw new Error('Tool handler is required');
    }
    
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' already exists`);
    }
    
    // 验证工具名称格式
    if (!/^[a-zA-Z0-9\-_\/]+$/.test(tool.name)) {
      throw new Error(`Invalid tool name format: ${tool.name}`);
    }
  }

  /**
   * 列出所有工具的简要信息
   */
  list(): Array<{
    name: string;
    description: string;
    category: string;
    version?: string;
    tags?: string[];
    requiresAuth: boolean;
    rateLimited: boolean;
  }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.metadata?.category || 'uncategorized',
      version: tool.metadata?.version,
      tags: tool.metadata?.tags,
      requiresAuth: tool.metadata?.requiresAuth || false,
      rateLimited: tool.metadata?.rateLimited || false
    }));
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 清空所有工具（除了默认工具）
   */
  clear(keepDefaults: boolean = true): void {
    if (keepDefaults) {
      // 保留核心工具
      const coreTools = Array.from(this.tools.entries())
        .filter(([_, tool]) => tool.metadata?.category === 'core');
      
      this.tools.clear();
      this.categories.clear();
      
      // 重新注册核心工具
      coreTools.forEach(([_, tool]) => this.register(tool));
    } else {
      this.tools.clear();
      this.categories.clear();
    }
    
    logger.info('[Registry] Tools cleared', { 
      keepDefaults,
      remaining: this.tools.size 
    });
  }

  /**
   * 导出工具配置
   */
  export(): any {
    return {
      tools: this.list(),
      categories: Array.from(this.categories.entries()),
      stats: this.getStats(),
      exportTime: new Date().toISOString()
    };
  }
}

/**
 * 全局工具注册实例
 */
export const toolRegistry = new ToolRegistry();

/**
 * 导出所有默认工具
 */
export * from './chimech-ask'; 