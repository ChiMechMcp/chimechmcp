/**
 * 千机阁MCP服务器配置管理
 */

import { z } from 'zod';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { ChiMechConfig } from '@/types';
import { ChiMechConfigSchema, ChiMechError } from '@/types';

// 加载环境变量
config();

/**
 * 从环境变量加载配置
 */
function loadFromEnv(): Partial<ChiMechConfig> {
  return {
    apiKey: process.env.CHIMECH_API_KEY || '',
    serverUrl: process.env.CHIMECH_SERVER_URL || 'https://api.chimech.com',
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.RETRY_COUNT || '3', 10),
    cacheEnabled: process.env.CACHE_TTL !== '0',
    cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10),
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10),
    clientType: (process.env.CLIENT_TYPE as any) || 'auto',
    workspaceId: process.env.WORKSPACE_ID,
    teamId: process.env.TEAM_ID
  };
}

/**
 * 从配置文件加载配置
 */
function loadFromFile(filePath?: string): Partial<ChiMechConfig> {
  const configPath = filePath || 
    process.env.CONFIG_FILE || 
    join(process.cwd(), 'config', 'chimech.yml');

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    
    // 支持YAML和JSON格式
    const config = configPath.endsWith('.json') 
      ? JSON.parse(content)
      : parseYaml(content);
    
    return config;
  } catch (error) {
    throw new ChiMechError(
      `Failed to load config file: ${configPath}`,
      'CONFIG_LOAD_ERROR',
      500,
      { error: error instanceof Error ? error.message : error }
    );
  }
}

/**
 * 合并并验证配置
 */
function mergeAndValidateConfig(
  envConfig: Partial<ChiMechConfig>,
  fileConfig: Partial<ChiMechConfig>
): ChiMechConfig {
  // 文件配置优先级高于环境变量
  const merged = { ...envConfig, ...fileConfig };
  
  try {
    return ChiMechConfigSchema.parse(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      
      throw new ChiMechError(
        `Configuration validation failed: ${issues}`,
        'CONFIG_VALIDATION_ERROR',
        400,
        { issues: error.issues }
      );
    }
    throw error;
  }
}

/**
 * 获取代理配置
 */
export function getProxyConfig() {
  return {
    httpProxy: process.env.HTTP_PROXY,
    httpsProxy: process.env.HTTPS_PROXY,
    noProxy: process.env.NO_PROXY
  };
}

/**
 * 获取调试配置
 */
export function getDebugConfig() {
  return {
    debug: process.env.DEBUG === 'true',
    verbose: process.env.VERBOSE === 'true',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    logFile: process.env.LOG_FILE
  };
}

/**
 * 获取企业配置
 */
export function getEnterpriseConfig() {
  return {
    workspaceId: process.env.WORKSPACE_ID,
    teamId: process.env.TEAM_ID,
    enableMultimodal: process.env.ENABLE_MULTIMODAL === 'true',
    enableWorkflow: process.env.ENABLE_WORKFLOW === 'true',
    rateLimit: parseInt(process.env.RATE_LIMIT || '60', 10)
  };
}

/**
 * 主配置加载函数
 */
export function loadConfig(configPath?: string): ChiMechConfig {
  const envConfig = loadFromEnv();
  const fileConfig = loadFromFile(configPath);
  
  return mergeAndValidateConfig(envConfig, fileConfig);
}

/**
 * 验证配置
 */
export function validateConfig(config: ChiMechConfig): void {
  // API密钥检查
  if (!config.apiKey || config.apiKey === 'your-api-key-here') {
    throw new ChiMechError(
      'API密钥未配置或使用了示例值，请设置CHIMECH_API_KEY环境变量',
      'MISSING_API_KEY',
      400
    );
  }
  
  // 服务器URL检查
  try {
    new URL(config.serverUrl);
  } catch {
    throw new ChiMechError(
      `无效的服务器URL: ${config.serverUrl}`,
      'INVALID_SERVER_URL',
      400
    );
  }
  
  // 数值范围检查
  if (config.timeout < 1000 || config.timeout > 300000) {
    throw new ChiMechError(
      '超时时间必须在1000-300000毫秒之间',
      'INVALID_TIMEOUT',
      400
    );
  }
  
  if (config.retryCount < 0 || config.retryCount > 10) {
    throw new ChiMechError(
      '重试次数必须在0-10之间',
      'INVALID_RETRY_COUNT',
      400
    );
  }
  
  if (config.maxConcurrentRequests < 1 || config.maxConcurrentRequests > 20) {
    throw new ChiMechError(
      '最大并发请求数必须在1-20之间',
      'INVALID_CONCURRENT_REQUESTS',
      400
    );
  }
}

/**
 * 生成配置示例
 */
export function generateConfigExample(): string {
  return `# 千机阁MCP服务器配置文件
# 支持YAML和JSON格式

# 基础配置
apiKey: "your-api-key-here"
serverUrl: "https://api.chimech.com"

# 性能配置
timeout: 30000
retryCount: 3
maxConcurrentRequests: 5

# 缓存配置
cacheEnabled: true
cacheTtl: 300

# 日志配置
logLevel: "info"

# 客户端配置
clientType: "auto"

# 企业配置 (可选)
# workspaceId: "your-workspace-id"
# teamId: "your-team-id"
`;
}

// 按需加载配置（避免导入时自动执行）
let _defaultConfig: ChiMechConfig | null = null;

export function getDefaultConfig(): ChiMechConfig {
  if (!_defaultConfig) {
    _defaultConfig = loadConfig();
  }
  return _defaultConfig;
} 