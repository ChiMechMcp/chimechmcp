/**
 * 千机阁MCP服务器核心类型定义
 */

import { z } from 'zod';

// ===== 基础配置类型 =====
export interface ChiMechConfig {
  apiKey: string;
  serverUrl: string;
  timeout: number;
  retryCount: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrentRequests: number;
  clientType?: 'cursor' | 'cherry-studio' | 'claude-desktop' | 'deepchat' | 'auto';
  workspaceId?: string;
  teamId?: string;
}

// ===== 数字员工类型 =====
export interface DigitalEmployee {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  avatar?: string;
  description: string;
  capabilities: EmployeeCapability[];
  status: 'active' | 'inactive' | 'busy';
}

export interface EmployeeCapability {
  type: 'code-review' | 'architecture' | 'business' | 'creative' | 'analysis' | 'support';
  level: 'junior' | 'senior' | 'expert';
  domains: string[];
}

// ===== MCP工具相关类型 =====
export interface ChiMechTool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  handler: ToolHandler;
  metadata?: ToolMetadata;
}

export interface ToolMetadata {
  category: string;
  tags: string[];
  version: string;
  author?: string;
  requiresAuth: boolean;
  rateLimited: boolean;
}

export type ToolHandler = (
  args: any,
  context: ToolContext
) => Promise<ToolResponse>;

export interface ToolContext {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  teamId?: string;
  clientType?: string;
  apiClient: ChiMechApiClient;
  cache: CacheManager;
  logger: Logger;
}

export interface ToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'file' | 'json';
    text?: string;
    data?: any;
    mimeType?: string;
  }>;
  metadata?: {
    executionTime: number;
    employeeId?: string;
    cached?: boolean;
    suggestions?: string[];
    error?: boolean;
  };
}

// ===== API请求/响应类型 =====
export interface ChiMechApiRequest {
  question: string;
  context?: string;
  priority: 'low' | 'normal' | 'high';
  employeeId?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface ChiMechApiResponse {
  answer: string;
  employeeId: string;
  employeeName: string;
  confidence: number;
  sources?: Array<{
    type: 'knowledge' | 'document' | 'code';
    title: string;
    url?: string;
    excerpt: string;
  }>;
  suggestions?: string[];
  relatedQuestions?: string[];
  metadata: {
    processingTime: number;
    model: string;
    tokens: {
      input: number;
      output: number;
    };
  };
}

// ===== 缓存管理接口 =====
export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// ===== API客户端接口 =====
export interface ChiMechApiClient {
  processRequest(request: ChiMechApiRequest): Promise<ChiMechApiResponse>;
  listEmployees(): Promise<DigitalEmployee[]>;
  getEmployee(id: string): Promise<DigitalEmployee>;
  healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }>;
}

// ===== 日志接口 =====
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}

// ===== 服务器统计接口 =====
export interface ServerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  uptime: number;
  topEmployees: Array<{
    id: string;
    name: string;
    requestCount: number;
  }>;
  topTools: Array<{
    name: string;
    callCount: number;
  }>;
}

// ===== 错误类型 =====
export class ChiMechError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ChiMechError';
  }
}

export class AuthenticationError extends ChiMechError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_FAILED', 401);
  }
}

export class RateLimitError extends ChiMechError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
  }
}

export class ValidationError extends ChiMechError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

// ===== Zod校验模式 =====
export const ChiMechConfigSchema = z.object({
  apiKey: z.string().min(1, 'API密钥不能为空'),
  serverUrl: z.string().url('服务器地址必须是有效的URL'),
  timeout: z.number().min(1000).max(300000).default(30000),
  retryCount: z.number().min(0).max(10).default(3),
  cacheEnabled: z.boolean().default(true),
  cacheTtl: z.number().min(0).default(300),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  maxConcurrentRequests: z.number().min(1).max(20).default(5),
  clientType: z.enum(['cursor', 'cherry-studio', 'claude-desktop', 'deepchat', 'auto']).optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional()
});

export const ChiMechApiRequestSchema = z.object({
  question: z.string().min(1, '问题不能为空'),
  context: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  employeeId: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
}); 