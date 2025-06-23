# 千机阁MCP服务器开发最佳实践

## 🎯 架构设计原则

### 1. 分层架构设计

```
┌─────────────────────────────────────┐
│         MCP协议层 (Protocol)         │  ← 处理MCP协议通信
├─────────────────────────────────────┤
│         工具路由层 (Router)          │  ← 工具注册和路由分发
├─────────────────────────────────────┤
│         业务逻辑层 (Service)         │  ← 核心业务逻辑实现
├─────────────────────────────────────┤
│         数据访问层 (Repository)      │  ← API调用和数据处理
├─────────────────────────────────────┤
│         基础设施层 (Infrastructure)  │  ← 缓存、日志、配置管理
└─────────────────────────────────────┘
```

**实现示例**:
```typescript
// src/layers/protocol/mcp-server.ts
export class MCPServer {
  constructor(
    private router: ToolRouter,
    private logger: Logger
  ) {}
  
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    return this.router.route(request);
  }
}

// src/layers/router/tool-router.ts
export class ToolRouter {
  private tools = new Map<string, RegisteredTool>();
  
  register(tool: RegisteredTool): void {
    this.tools.set(tool.name, tool);
  }
  
  async route(request: MCPRequest): Promise<MCPResponse> {
    const tool = this.tools.get(request.method);
    if (!tool) throw new Error(`Unknown tool: ${request.method}`);
    
    return tool.handler(request.params, this.createContext());
  }
}
```

### 2. 依赖注入模式

```typescript
// src/container/di-container.ts
export class DIContainer {
  private services = new Map<string, any>();
  
  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }
  
  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) throw new Error(`Service not found: ${key}`);
    return factory();
  }
}

// 服务注册
container.register('apiClient', () => new ChimechAPIClient(config));
container.register('cache', () => new RedisCache(config.redis));
container.register('logger', () => new WinstonLogger(config.logging));
```

## 🔧 代码质量保证

### 1. TypeScript严格模式

```json
// tsconfig.json - 推荐配置
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 2. 类型安全的工具开发

```typescript
// 使用泛型确保类型安全
export function createTool<TSchema extends z.ZodSchema>(
  definition: ToolDefinition<TSchema>
): TypedTool<TSchema> {
  return {
    ...definition,
    handler: async (args: z.infer<TSchema>, context: ToolContext) => {
      // 运行时验证
      const validatedArgs = definition.schema.parse(args);
      return definition.handler(validatedArgs, context);
    }
  };
}

// 类型安全的响应构建器
export class ResponseBuilder {
  static success(text: string, metadata?: object): MCPResponse {
    return {
      content: [{ type: 'text', text }],
      metadata
    };
  }
  
  static error(message: string, code: string): MCPResponse {
    return {
      content: [{
        type: 'text',
        text: `❌ ${message}\n\n错误代码: ${code}`
      }],
      metadata: { error: true, errorCode: code }
    };
  }
}
```

## 🚀 性能优化策略

### 1. 智能缓存系统

```typescript
// src/cache/intelligent-cache.ts
export class IntelligentCache {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0, evictions: 0 };
  
  async get<T>(
    key: string, 
    fetcher?: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T | null> {
    const entry = this.cache.get(key);
    
    // 缓存命中且未过期
    if (entry && Date.now() < entry.expiry) {
      this.stats.hits++;
      this.updateAccessTime(key);
      return entry.value;
    }
    
    this.stats.misses++;
    
    // 自动获取数据
    if (fetcher) {
      const value = await fetcher();
      this.set(key, value, options?.ttl);
      return value;
    }
    
    return null;
  }
}
```

### 2. 请求批处理优化

```typescript
// src/batch/batch-processor.ts
export class BatchProcessor {
  private queue: BatchItem[] = [];
  private processing = false;
  
  async add<T>(request: BatchRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.scheduleProcess();
    });
  }
  
  private async scheduleProcess(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    // 等待更多请求聚合
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const batch = this.queue.splice(0, 50); // 最多50个请求
    
    try {
      const results = await this.processBatch(batch);
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
    
    this.processing = false;
    
    // 处理剩余队列
    if (this.queue.length > 0) {
      this.scheduleProcess();
    }
  }
}
```

## 🔒 安全最佳实践

### 1. API密钥安全管理

```typescript
// src/security/key-manager.ts
export class APIKeyManager {
  private keys = new Map<string, KeyInfo>();
  
  validateKey(key: string): boolean {
    const keyInfo = this.keys.get(key);
    
    if (!keyInfo) return false;
    if (keyInfo.expiresAt < Date.now()) return false;
    if (keyInfo.suspended) return false;
    
    // 更新使用统计
    keyInfo.lastUsed = Date.now();
    keyInfo.usageCount++;
    
    return true;
  }
  
  // 密钥轮换
  async rotateKey(oldKey: string): Promise<string> {
    const newKey = this.generateSecureKey();
    const keyInfo = this.keys.get(oldKey);
    
    if (keyInfo) {
      this.keys.set(newKey, {
        ...keyInfo,
        createdAt: Date.now(),
        rotatedFrom: oldKey
      });
      
      // 保持旧密钥短期有效以平滑过渡
      setTimeout(() => this.keys.delete(oldKey), 24 * 60 * 60 * 1000);
    }
    
    return newKey;
  }
}
```

### 2. 请求频率限制

```typescript
// src/security/rate-limiter.ts
export class RateLimiter {
  private requests = new Map<string, RequestInfo[]>();
  
  async checkLimit(
    identifier: string, 
    limit: number, 
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // 获取时间窗口内的请求
    const userRequests = this.requests.get(identifier) || [];
    const validRequests = userRequests.filter(req => req.timestamp > windowStart);
    
    // 检查是否超限
    if (validRequests.length >= limit) {
      return false;
    }
    
    // 记录新请求
    validRequests.push({ timestamp: now });
    this.requests.set(identifier, validRequests);
    
    return true;
  }
}
```

## 📊 监控和日志

### 1. 结构化日志

```typescript
// src/logging/structured-logger.ts
export class StructuredLogger {
  log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'chimech-mcp',
      version: process.env.APP_VERSION,
      requestId: context?.requestId,
      userId: context?.userId,
      tool: context?.tool,
      duration: context?.duration,
      metadata: context?.metadata
    };
    
    // 输出到不同目标
    this.writeToConsole(logEntry);
    this.writeToFile(logEntry);
    this.sendToMonitoring(logEntry);
  }
  
  // 性能日志
  logPerformance(operation: string, duration: number, metadata?: object): void {
    this.log('info', `Performance: ${operation}`, {
      duration,
      metadata: { ...metadata, type: 'performance' }
    });
  }
}
```

## 🧪 测试策略

### 1. 测试金字塔

```
       ┌─────────────┐
       │   E2E测试    │  ← 少量，覆盖关键用户流程
       │   (5-10%)   │
       ├─────────────┤
       │  集成测试    │  ← 中等数量，测试组件协作
       │  (20-30%)   │
       ├─────────────┤
       │  单元测试    │  ← 大量，快速反馈
       │  (60-70%)   │
       └─────────────┘
```

### 2. 单元测试最佳实践

```typescript
// tests/tools/query-tool.test.ts
describe('QueryTool', () => {
  let mockContext: ToolContext;
  let mockAPIClient: jest.Mocked<ChimechAPIClient>;
  
  beforeEach(() => {
    mockAPIClient = createMockAPIClient();
    mockContext = createMockContext({ apiClient: mockAPIClient });
  });
  
  it('should return successful response for valid query', async () => {
    // Arrange
    const input = { question: 'What is TypeScript?', priority: 'normal' as const };
    mockAPIClient.processRequest.mockResolvedValue({
      answer: 'TypeScript is a typed superset of JavaScript'
    });
    
    // Act
    const result = await queryTool.handler(input, mockContext);
    
    // Assert
    expect(result.content[0].text).toContain('TypeScript is a typed superset');
    expect(mockAPIClient.processRequest).toHaveBeenCalledWith({
      question: 'What is TypeScript?',
      priority: 'normal',
      requestId: mockContext.requestId
    });
  });
});
```

这些最佳实践为千机阁MCP服务器的开发提供了完整的指导框架，确保代码质量、性能和可维护性。 