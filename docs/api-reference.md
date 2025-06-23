# 千机阁MCP服务器 - API参考手册

## 📋 概述

千机阁MCP服务器提供了一套完整的数字员工服务接口，基于Model Context Protocol (MCP)标准实现。所有工具都遵循统一的调用规范和错误处理机制。

## 🛠️ 工具分类

### 📝 核心查询工具

#### `chimech/query` - 智能问答查询

**描述**: 处理用户的智能问答请求，支持上下文理解和多轮对话。

**参数Schema**:
```typescript
{
  question: string;           // 必需 - 用户问题
  context?: string;          // 可选 - 上下文信息
  priority?: 'low' | 'normal' | 'high';  // 可选 - 优先级，默认normal
  maxTokens?: number;        // 可选 - 最大token数，默认2000
  temperature?: number;      // 可选 - 温度参数，默认0.7
}
```

**返回格式**:
```typescript
{
  content: [{
    type: 'text',
    text: string;            // 回答内容
  }],
  metadata?: {
    tokens_used: number;     // 使用的token数
    response_time: number;   // 响应时间(ms)
    confidence: number;      // 置信度(0-1)
  }
}
```

**使用示例**:
```json
{
  "name": "chimech/query",
  "arguments": {
    "question": "什么是TypeScript的泛型？",
    "context": "我正在学习前端开发",
    "priority": "normal"
  }
}
```

**错误码**:
- `INVALID_QUESTION`: 问题为空或格式错误
- `CONTEXT_TOO_LONG`: 上下文超出长度限制
- `API_RATE_LIMIT`: API调用频率超限
- `API_ERROR`: 千机阁API服务错误

---

#### `chimech/analyze` - 文档分析处理

**描述**: 分析和处理各种类型的文档内容，提供结构化的分析结果。

**参数Schema**:
```typescript
{
  content: string;                    // 必需 - 待分析内容
  type: 'text' | 'code' | 'data';   // 必需 - 内容类型
  options?: {
    language?: string;               // 代码语言(当type为code时)
    format?: 'summary' | 'detailed'; // 分析详细程度
    extractKeywords?: boolean;       // 是否提取关键词
  }
}
```

**返回格式**:
```typescript
{
  content: [{
    type: 'text',
    text: string;                    // 分析结果
  }],
  analysis: {
    type: string;                    // 内容类型
    summary: string;                 // 内容摘要
    keywords?: string[];             // 关键词列表
    structure?: object;              // 结构化信息
    metrics?: {
      word_count: number;
      complexity_score: number;
      readability_score: number;
    }
  }
}
```

---

#### `chimech/generate` - 内容生成工具

**描述**: 基于提示词生成各种类型的内容，支持多种生成模式。

**参数Schema**:
```typescript
{
  prompt: string;                    // 必需 - 生成提示词
  type?: 'text' | 'code' | 'email' | 'report'; // 生成类型
  options?: {
    length?: 'short' | 'medium' | 'long';      // 内容长度
    style?: 'formal' | 'casual' | 'technical'; // 写作风格
    language?: string;                          // 目标语言
    template?: string;                          // 使用模板
  }
}
```

---

#### `chimech/search` - 知识库搜索

**描述**: 在千机阁知识库中搜索相关信息，支持语义搜索和精确匹配。

**参数Schema**:
```typescript
{
  query: string;                     // 必需 - 搜索查询
  filters?: {
    category?: string[];             // 分类筛选
    dateRange?: {
      start: string;                 // 开始日期
      end: string;                   // 结束日期
    };
    source?: string[];               // 来源筛选
  };
  options?: {
    limit?: number;                  // 结果数量限制，默认10
    offset?: number;                 // 结果偏移量
    sortBy?: 'relevance' | 'date';   // 排序方式
  }
}
```

## 🔧 工具开发规范

### 标准工具结构

```typescript
// 工具定义接口
interface ToolDefinition<TSchema extends z.ZodSchema> {
  name: string;                      // 工具名称，格式: chimech/tool-name
  description: string;               // 工具描述
  schema: TSchema;                   // 参数验证schema
  handler: ToolHandler<TSchema>;     // 处理函数
  metadata?: {
    version: string;                 // 工具版本
    category: string;                // 工具分类
    tags: string[];                  // 标签
  };
}

// 处理函数接口
type ToolHandler<TSchema extends z.ZodSchema> = (
  args: z.infer<TSchema>,
  context: ToolContext
) => Promise<MCPResponse>;

// 上下文接口
interface ToolContext {
  requestId: string;                 // 请求ID
  userId?: string;                   // 用户ID
  apiClient: ChimechAPIClient;       // API客户端
  logger: Logger;                    // 日志记录器
  cache: CacheManager;               // 缓存管理器
}
```

### 错误处理规范

```typescript
// 标准错误类型
class ChimechMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ChimechMCPError';
  }
}

// 常用错误码
export const ERROR_CODES = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
```

### 响应格式规范

```typescript
// 标准响应格式
interface MCPResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  metadata?: {
    [key: string]: any;
  };
}

// 成功响应示例
const successResponse: MCPResponse = {
  content: [{
    type: 'text',
    text: '处理成功的结果内容'
  }],
  metadata: {
    processingTime: 150,
    tokensUsed: 45
  }
};

// 错误响应示例
const errorResponse: MCPResponse = {
  content: [{
    type: 'text',
    text: '❌ 处理失败\n\n错误信息: 参数验证失败\n解决建议: 请检查输入参数格式'
  }],
  metadata: {
    error: true,
    errorCode: 'INVALID_PARAMS'
  }
};
```

## 🔒 安全和认证

### API密钥管理

```typescript
// 环境变量配置
interface SecurityConfig {
  CHIMECH_API_KEY: string;           // 千机阁API密钥
  API_KEY_ROTATION_DAYS?: number;    // 密钥轮换天数
  MAX_REQUESTS_PER_MINUTE?: number;  // 每分钟最大请求数
  ALLOWED_ORIGINS?: string[];        // 允许的来源域名
}
```

### 权限控制

```typescript
// 权限验证中间件
async function validatePermissions(
  toolName: string,
  context: ToolContext
): Promise<boolean> {
  // 实现权限验证逻辑
  return true;
}
```

## 📊 性能和监控

### 性能指标

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| 响应时间 | < 200ms (P95) | APM监控 |
| 错误率 | < 0.1% | 错误日志统计 |
| 内存使用 | < 100MB | 系统监控 |
| CPU使用率 | < 50% | 系统监控 |

### 日志格式

```typescript
// 标准日志格式
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  tool?: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  metadata?: object;
}
```

## 🧪 测试规范

### 单元测试

```typescript
// 工具测试模板
describe('ChimechTool', () => {
  let mockContext: ToolContext;
  
  beforeEach(() => {
    mockContext = createMockContext();
  });
  
  it('should handle valid input', async () => {
    const result = await tool.handler(validInput, mockContext);
    expect(result.content[0].text).toContain('expected content');
  });
  
  it('should validate input schema', async () => {
    await expect(
      tool.handler(invalidInput, mockContext)
    ).rejects.toThrow(ChimechMCPError);
  });
});
```

### 集成测试

```typescript
// MCP服务器集成测试
describe('MCP Server Integration', () => {
  let server: MCPServer;
  
  beforeAll(async () => {
    server = await createTestServer();
  });
  
  it('should register all tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(expectedToolCount);
  });
});
```

## 📈 版本和更新

### 版本控制

- **主版本**: 破坏性API变更
- **次版本**: 新功能添加
- **修订版本**: Bug修复和性能优化

### 更新日志

查看 [CHANGELOG.md](../CHANGELOG.md) 获取详细的版本更新信息。

## 🔗 相关链接

- [MCP协议规范](https://modelcontextprotocol.io)
- [千机阁开发者文档](https://docs.chimech.com)
- [GitHub仓库](https://github.com/your-org/chimechmcp)
- [问题反馈](https://github.com/your-org/chimechmcp/issues) 