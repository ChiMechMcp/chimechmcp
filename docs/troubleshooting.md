# 千机阁MCP服务器故障排除指南

## 🚨 常见问题快速诊断

### 问题分类索引

| 问题类型 | 症状 | 快速检查 |
|---------|------|----------|
| [连接问题](#-连接问题) | 无法连接到MCP服务器 | 检查端口和进程状态 |
| [认证失败](#-认证问题) | API密钥错误 | 验证环境变量配置 |
| [工具调用失败](#-工具调用问题) | 工具执行报错 | 检查参数格式和权限 |
| [性能问题](#-性能问题) | 响应缓慢或超时 | 监控资源使用情况 |
| [日志问题](#-日志和监控问题) | 日志缺失或格式异常 | 检查日志配置 |

## 🔌 连接问题

### 症状：MCP客户端无法连接到服务器

#### 诊断步骤

1. **检查服务器状态**
```bash
# 检查进程是否运行
ps aux | grep chimech-mcp

# 检查端口监听
netstat -tlnp | grep 3000
# 或使用 lsof
lsof -i :3000
```

2. **验证服务器启动**
```bash
# 手动启动服务器查看错误信息
node dist/index.js

# 检查健康状态
curl http://localhost:3000/health
```

3. **检查日志文件**
```bash
# 查看最新日志
tail -f logs/chimech-mcp.log

# 搜索错误信息
grep -i error logs/chimech-mcp.log
```

#### 常见解决方案

**问题**: 端口被占用
```bash
# 查找占用端口的进程
lsof -ti:3000 | xargs kill -9

# 或更改服务器端口
export PORT=3001
```

**问题**: 权限不足
```bash
# 检查文件权限
ls -la dist/index.js

# 修复权限
chmod +x dist/index.js
```

**问题**: 依赖缺失
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 或使用pnpm
pnpm install --frozen-lockfile
```

### 症状：客户端配置错误

#### Cursor IDE 配置问题

**检查配置文件**:
```json
// .cursor/mcp.json - 确保路径和参数正确
{
  "mcpServers": {
    "chimech-mcp": {
      "command": "node",
      "args": ["./dist/index.js"],  // 确认文件存在
      "env": {
        "CHIMECH_API_KEY": "your-api-key"  // 确认密钥有效
      }
    }
  }
}
```

**常见配置错误**:
- 路径错误：`./dist/index.js` 不存在
- 环境变量缺失：`CHIMECH_API_KEY` 未设置
- Node.js版本不兼容：需要 >= 18.0.0

## 🔐 认证问题

### 症状：API密钥验证失败

#### 诊断步骤

1. **验证API密钥格式**
```typescript
// 检查密钥格式是否正确
const apiKey = process.env.CHIMECH_API_KEY;
console.log('API Key length:', apiKey?.length);
console.log('API Key format:', /^chimech_[a-zA-Z0-9]{32}$/.test(apiKey));
```

2. **测试API连接**
```bash
# 使用curl测试API连接
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.chimech.com/v1/health
```

3. **检查密钥权限**
```typescript
// 验证密钥权限范围
const permissions = await apiClient.getPermissions();
console.log('Available permissions:', permissions);
```

#### 解决方案

**问题**: 密钥过期
```bash
# 联系千机阁支持获取新密钥
# 或在开发者控制台重新生成
```

**问题**: 密钥权限不足
```typescript
// 检查所需权限
const requiredPermissions = [
  'mcp:tools:execute',
  'api:query:access',
  'api:analyze:access'
];

// 在API密钥配置中启用这些权限
```

**问题**: 环境变量未生效
```bash
# 检查环境变量
echo $CHIMECH_API_KEY

# 重新加载环境变量
source .env

# 或在启动时指定
CHIMECH_API_KEY=your_key node dist/index.js
```

## 🛠️ 工具调用问题

### 症状：工具执行失败或返回错误

#### 诊断步骤

1. **检查工具注册状态**
```typescript
// 列出已注册的工具
const registeredTools = server.listTools();
console.log('Registered tools:', registeredTools.map(t => t.name));
```

2. **验证参数格式**
```typescript
// 使用工具schema验证参数
try {
  const validatedArgs = toolSchema.parse(args);
  console.log('Valid args:', validatedArgs);
} catch (error) {
  console.error('Validation error:', error.errors);
}
```

3. **检查工具权限**
```typescript
// 验证工具执行权限
const hasPermission = await permissionChecker.check(
  toolName, 
  context.userId
);
console.log('Has permission:', hasPermission);
```

#### 常见错误和解决方案

**错误**: `Tool not found: chimech/query`
```typescript
// 确保工具已正确注册
import { queryTool } from './tools/query-tool.js';
server.registerTool(queryTool);

// 检查工具名称拼写
console.log('Expected:', 'chimech/query');
console.log('Actual:', queryTool.name);
```

**错误**: `Invalid parameters`
```typescript
// 检查参数schema定义
const QuerySchema = z.object({
  question: z.string().min(1),  // 确保必需字段存在
  context: z.string().optional()
});

// 调试参数验证
try {
  QuerySchema.parse(inputArgs);
} catch (error) {
  console.error('Schema validation failed:', error.errors);
}
```

**错误**: `API rate limit exceeded`
```typescript
// 实现重试机制
async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'RATE_LIMIT' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

**错误**: `Timeout waiting for response`
```typescript
// 增加超时时间
const config = {
  timeout: 30000,  // 30秒
  retryAttempts: 3
};

// 或实现流式响应
async function* streamResponse(request: any) {
  const response = await apiClient.streamRequest(request);
  for await (const chunk of response) {
    yield chunk;
  }
}
```

## ⚡ 性能问题

### 症状：响应缓慢或资源占用过高

#### 性能监控

1. **监控关键指标**
```typescript
// 响应时间监控
const startTime = Date.now();
try {
  const result = await processRequest(request);
  const duration = Date.now() - startTime;
  
  if (duration > 5000) {  // 超过5秒
    logger.warn('Slow request detected', { duration, request });
  }
  
  return result;
} catch (error) {
  logger.error('Request failed', { error, duration: Date.now() - startTime });
  throw error;
}
```

2. **内存使用监控**
```typescript
// 定期检查内存使用
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
  
  if (memUsageMB.heapUsed > 200) {  // 超过200MB
    logger.warn('High memory usage detected', memUsageMB);
  }
}, 30000);  // 每30秒检查一次
```

#### 性能优化方案

**问题**: 缓存未生效
```typescript
// 检查缓存配置
const cacheStats = await cache.getStats();
console.log('Cache hit rate:', cacheStats.hitRate);

// 优化缓存策略
const cacheKey = `query:${hashRequest(request)}`;
const cachedResult = await cache.get(cacheKey);

if (cachedResult) {
  return cachedResult;
}

const result = await processRequest(request);
await cache.set(cacheKey, result, { ttl: 300000 }); // 5分钟
return result;
```

**问题**: 数据库连接池耗尽
```typescript
// 监控连接池状态
const poolStats = connectionPool.getStats();
console.log('Active connections:', poolStats.active);
console.log('Idle connections:', poolStats.idle);

// 优化连接管理
const connection = await connectionPool.acquire();
try {
  return await connection.query(sql, params);
} finally {
  connectionPool.release(connection);  // 确保连接释放
}
```

**问题**: 批处理效率低
```typescript
// 实现智能批处理
class SmartBatcher {
  private batch: Request[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  add(request: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.batch.push({ request, resolve, reject });
      
      // 达到批次大小或超时时处理
      if (this.batch.length >= 10) {
        this.processBatch();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.processBatch(), 100);
      }
    });
  }
  
  private async processBatch() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    const currentBatch = this.batch.splice(0);
    const requests = currentBatch.map(item => item.request);
    
    try {
      const results = await this.batchProcess(requests);
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => item.reject(error));
    }
  }
}
```

## 📝 日志和监控问题

### 症状：日志缺失或格式异常

#### 日志配置检查

1. **验证日志配置**
```typescript
// 检查日志级别设置
console.log('Log level:', process.env.LOG_LEVEL);

// 测试日志输出
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

2. **检查日志文件权限**
```bash
# 检查日志目录权限
ls -la logs/

# 修复权限问题
chmod 755 logs/
chmod 644 logs/*.log
```

3. **验证日志轮转**
```typescript
// 检查日志文件大小
const fs = require('fs');
const logFiles = fs.readdirSync('logs/');
logFiles.forEach(file => {
  const stats = fs.statSync(`logs/${file}`);
  console.log(`${file}: ${Math.round(stats.size / 1024 / 1024)}MB`);
});
```

#### 解决方案

**问题**: 日志不输出
```typescript
// 检查日志级别配置
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

**问题**: 日志格式混乱
```typescript
// 统一日志格式
const logFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  return `${timestamp} [${level.toUpperCase()}] ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
  }`;
});

logger.format = winston.format.combine(
  winston.format.timestamp(),
  logFormat
);
```

## 🔧 调试工具和技巧

### 开发环境调试

1. **启用详细日志**
```bash
# 设置调试环境变量
export DEBUG=chimech:*
export LOG_LEVEL=debug
export NODE_ENV=development

# 启动服务器
npm run dev
```

2. **使用MCP Inspector**
```bash
# 安装MCP Inspector
npm install -g @modelcontextprotocol/inspector

# 启动Inspector
mcp-inspector
```

3. **API测试工具**
```typescript
// 创建测试脚本 scripts/test-api.js
const { ChimechAPIClient } = require('../dist/api/client.js');

async function testAPI() {
  const client = new ChimechAPIClient({
    apiKey: process.env.CHIMECH_API_KEY,
    baseUrl: process.env.CHIMECH_BASE_URL
  });
  
  try {
    const result = await client.query({
      question: 'Test question',
      priority: 'normal'
    });
    console.log('API Test Success:', result);
  } catch (error) {
    console.error('API Test Failed:', error);
  }
}

testAPI();
```

### 生产环境监控

1. **健康检查端点**
```typescript
// 实现详细的健康检查
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };
  
  // API连接检查
  try {
    await apiClient.ping();
    health.checks.api = { status: 'healthy' };
  } catch (error) {
    health.checks.api = { status: 'unhealthy', error: error.message };
    health.status = 'unhealthy';
  }
  
  // 缓存检查
  try {
    await cache.ping();
    health.checks.cache = { status: 'healthy' };
  } catch (error) {
    health.checks.cache = { status: 'unhealthy', error: error.message };
    health.status = 'unhealthy';
  }
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

2. **性能指标收集**
```typescript
// 收集关键性能指标
const metrics = {
  requestCount: 0,
  errorCount: 0,
  responseTimeSum: 0,
  responseTimeMax: 0
};

// 中间件收集指标
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  metrics.requestCount++;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.responseTimeSum += duration;
    metrics.responseTimeMax = Math.max(metrics.responseTimeMax, duration);
    
    if (res.statusCode >= 400) {
      metrics.errorCount++;
    }
  });
  
  next();
}

// 指标查询端点
app.get('/metrics', (req, res) => {
  const avgResponseTime = metrics.requestCount > 0 
    ? metrics.responseTimeSum / metrics.requestCount 
    : 0;
    
  res.json({
    requests_total: metrics.requestCount,
    errors_total: metrics.errorCount,
    response_time_avg: Math.round(avgResponseTime),
    response_time_max: metrics.responseTimeMax,
    error_rate: metrics.requestCount > 0 
      ? (metrics.errorCount / metrics.requestCount * 100).toFixed(2) + '%'
      : '0%'
  });
});
```

## 📞 获取帮助

### 社区支持

- **GitHub Issues**: [报告问题](https://github.com/your-org/chimechmcp/issues)
- **讨论区**: [GitHub Discussions](https://github.com/your-org/chimechmcp/discussions)
- **Discord**: [加入开发者社区](https://discord.gg/chimech)

### 企业支持

- **技术支持**: support@chimech.com
- **紧急问题**: 24/7 技术热线 (企业客户)
- **文档反馈**: docs@chimech.com

### 提交问题时请包含

1. **环境信息**
   - Node.js版本
   - 操作系统
   - MCP客户端类型和版本

2. **错误信息**
   - 完整的错误堆栈
   - 相关日志片段
   - 复现步骤

3. **配置信息**
   - 环境变量配置（隐藏敏感信息）
   - MCP客户端配置
   - 工具调用参数

这个故障排除指南涵盖了千机阁MCP服务器开发和运维中的常见问题，帮助开发者快速定位和解决问题。 