/**
 * 千机阁MCP服务器缓存管理
 */

import NodeCache from 'node-cache';
import type { CacheManager } from '@/types';

/**
 * 基于内存的缓存管理器实现
 */
export class MemoryCacheManager implements CacheManager {
  private cache: NodeCache;

  constructor(
    ttl: number = 300, // 默认5分钟TTL
    checkPeriod: number = 120 // 每2分钟检查过期缓存
  ) {
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: checkPeriod,
      useClones: false // 提高性能，但注意对象引用问题
    });
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const value = this.cache.get<T>(key);
    return value !== undefined ? value : null;
  }

  /**
   * 设置缓存值
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (ttl !== undefined) {
      this.cache.set(key, value, ttl);
    } else {
      this.cache.set(key, value);
    }
  }

  /**
   * 删除缓存值
   */
  async delete(key: string): Promise<void> {
    this.cache.del(key);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.cache.flushAll();
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * 获取所有缓存键
   */
  getAllKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * 获取缓存大小
   */
  getSize(): number {
    return this.cache.keys().length;
  }
}

/**
 * 缓存键生成器
 */
export class CacheKeyGenerator {
  /**
   * 为API请求生成缓存键
   */
  static forApiRequest(
    question: string,
    context?: string,
    employeeId?: string,
    capabilities?: string[]
  ): string {
    const parts = [
      'api_request',
      this.hashString(question),
      context ? this.hashString(context) : 'no_context',
      employeeId || 'auto_employee',
      capabilities ? capabilities.sort().join(',') : 'no_capabilities'
    ];
    
    return parts.join(':');
  }

  /**
   * 为员工列表生成缓存键
   */
  static forEmployeeList(): string {
    return 'employee_list';
  }

  /**
   * 为特定员工生成缓存键
   */
  static forEmployee(employeeId: string): string {
    return `employee:${employeeId}`;
  }

  /**
   * 为健康检查生成缓存键
   */
  static forHealthCheck(): string {
    return 'health_check';
  }

  /**
   * 简单字符串哈希函数
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * 智能缓存装饰器
 */
export function withCache<T extends any[], R>(
  cacheManager: CacheManager,
  keyGenerator: (...args: T) => string,
  ttl?: number
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const cacheKey = keyGenerator(...args);
      
      // 尝试从缓存获取
      const cached = await cacheManager.get<R>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // 执行原方法
      const result = await method.apply(this, args);
      
      // 缓存结果
      await cacheManager.set(cacheKey, result, ttl);
      
      return result;
    };
  };
}

/**
 * 缓存预热器
 */
export class CacheWarmer {
  constructor(
    private cacheManager: CacheManager
  ) {}

  /**
   * 预热常用数据
   */
  async warmUp(apiClient: any): Promise<void> {
    try {
      // 预热员工列表
      const employees = await apiClient.listEmployees();
      const employeeListKey = CacheKeyGenerator.forEmployeeList();
      await this.cacheManager.set(employeeListKey, employees, 600); // 10分钟

      // 预热每个员工的详细信息
      for (const employee of employees) {
        const employeeKey = CacheKeyGenerator.forEmployee(employee.id);
        await this.cacheManager.set(employeeKey, employee, 1800); // 30分钟
      }

      // 预热健康检查
      const health = await apiClient.healthCheck();
      const healthKey = CacheKeyGenerator.forHealthCheck();
      await this.cacheManager.set(healthKey, health, 60); // 1分钟
      
    } catch (error) {
      // 预热失败不应阻止服务启动
      console.warn('Cache warm-up failed:', error);
    }
  }
}

/**
 * 创建缓存管理器实例
 */
export function createCacheManager(
  enabled: boolean = true,
  ttl: number = 300
): CacheManager {
  if (!enabled) {
    // 返回空操作的缓存管理器
    return {
      async get() { return null; },
      async set() { },
      async delete() { },
      async clear() { },
      async has() { return false; }
    };
  }

  return new MemoryCacheManager(ttl);
} 