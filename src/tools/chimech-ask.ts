/**
 * 千机阁核心工具 - chimech/ask
 * 这是最重要的工具，用于与千机阁数字员工进行对话
 */

import { z } from 'zod';
import type { ChiMechTool, ToolContext, ToolResponse } from '@/types';
import { ChiMechApiRequestSchema, ValidationError } from '@/types';
import { CacheKeyGenerator } from '@/utils/cache';

// 工具参数Schema
const ChiMechAskSchema = z.object({
  question: z.string()
    .min(1, '问题不能为空')
    .max(4000, '问题长度不能超过4000字符'),
  
  context: z.string()
    .max(8000, '上下文长度不能超过8000字符')
    .optional()
    .describe('提供额外的上下文信息，帮助数字员工更好地理解和回答问题'),
  
  priority: z.enum(['low', 'normal', 'high'])
    .default('normal')
    .describe('请求优先级：low(低), normal(普通), high(高)'),
  
  employeeId: z.string()
    .optional()
    .describe('指定特定的数字员工ID，如果不指定将自动选择最适合的员工'),
  
  capabilities: z.array(z.enum([
    'code-review', 'architecture', 'business', 'creative', 'analysis', 'support'
  ]))
    .optional()
    .describe('需要的能力类型，用于智能路由到合适的员工'),
  
  useCache: z.boolean()
    .default(true)
    .describe('是否使用缓存，设为false将强制重新请求'),
  
  includeMetadata: z.boolean()
    .default(false)
    .describe('是否在响应中包含详细的元数据信息')
});

type ChiMechAskArgs = z.infer<typeof ChiMechAskSchema>;

/**
 * 智能问答处理器
 */
async function handleChiMechAsk(
  args: ChiMechAskArgs,
  context: ToolContext
): Promise<ToolResponse> {
  const startTime = Date.now();
  
  context.logger.info('[Tool] chimech/ask called', {
    requestId: context.requestId,
    question: args.question.substring(0, 100) + '...',
    priority: args.priority,
    employeeId: args.employeeId,
    useCache: args.useCache
  });

  try {
    // 构建API请求
    const apiRequest = ChiMechApiRequestSchema.parse({
      question: args.question,
      context: args.context,
      priority: args.priority,
      employeeId: args.employeeId,
      capabilities: args.capabilities,
      metadata: {
        requestId: context.requestId,
        toolName: 'chimech/ask',
        timestamp: new Date().toISOString()
      }
    });

    let response;
    let cached = false;

    // 缓存处理
    if (args.useCache) {
      const cacheKey = CacheKeyGenerator.forApiRequest(
        args.question,
        args.context,
        args.employeeId,
        args.capabilities
      );

      // 尝试从缓存获取
      const cachedResponse = await context.cache.get(cacheKey);
      if (cachedResponse) {
        response = cachedResponse;
        cached = true;
        context.logger.debug('[Tool] Using cached response', {
          requestId: context.requestId,
          cacheKey
        });
      } else {
        // 调用API并缓存结果
        response = await context.apiClient.processRequest(apiRequest);
        await context.cache.set(cacheKey, response, 300); // 缓存5分钟
        context.logger.debug('[Tool] Response cached', {
          requestId: context.requestId,
          cacheKey
        });
      }
    } else {
      // 不使用缓存，直接调用API
      response = await context.apiClient.processRequest(apiRequest);
    }

    const executionTime = Date.now() - startTime;

    context.logger.info('[Tool] chimech/ask completed', {
      requestId: context.requestId,
      employeeId: response.employeeId,
      employeeName: response.employeeName,
      executionTime,
      cached,
      confidence: response.confidence
    });

    // 构建响应内容
    const content: ToolResponse['content'] = [
      {
        type: 'text',
        text: formatResponse(response, args.includeMetadata, cached, executionTime)
      }
    ];

    // 如果有相关文档或资源，添加到响应中
    if (response.sources && response.sources.length > 0) {
      content.push({
        type: 'text',
        text: '\n\n**参考资料：**\n' + response.sources.map(source => 
          `- [${source.title}](${source.url || '#'}) - ${source.excerpt}`
        ).join('\n')
      });
    }

    // 如果有相关问题建议，添加到响应中
    if (response.relatedQuestions && response.relatedQuestions.length > 0) {
      content.push({
        type: 'text',
        text: '\n\n**相关问题：**\n' + response.relatedQuestions.map(q => 
          `- ${q}`
        ).join('\n')
      });
    }

    return {
      content,
      metadata: {
        executionTime,
        employeeId: response.employeeId,
        cached,
        suggestions: response.suggestions
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    context.logger.error('[Tool] chimech/ask failed', error as Error, {
      requestId: context.requestId,
      question: args.question.substring(0, 100),
      executionTime
    });

    // 友好的错误消息
    let errorMessage = '抱歉，处理您的问题时遇到了错误。';
    
    if (error instanceof ValidationError) {
      errorMessage = `参数验证失败: ${error.message}`;
    } else if (error instanceof Error) {
      // 根据错误类型提供不同的提示
      if (error.message.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试或简化您的问题。';
      } else if (error.message.includes('rate limit')) {
        errorMessage = '请求过于频繁，请稍后重试。';
      } else if (error.message.includes('authentication')) {
        errorMessage = 'API认证失败，请检查配置。';
      } else {
        errorMessage = `处理失败: ${error.message}`;
      }
    }

    return {
      content: [{
        type: 'text',
        text: errorMessage + '\n\n💡 **建议：**\n- 检查问题是否清晰明确\n- 尝试提供更多上下文\n- 如果问题复杂，可以分步骤询问'
      }],
      metadata: {
        executionTime,
        cached: false,
        error: true
      }
    };
  }
}

/**
 * 格式化响应内容
 */
function formatResponse(
  response: any,
  includeMetadata: boolean,
  cached: boolean,
  executionTime: number
): string {
  let formatted = response.answer;

  // 添加员工信息
  formatted += `\n\n---\n📋 **回答提供者：** ${response.employeeName}`;
  
  if (response.confidence) {
    const confidenceEmoji = response.confidence >= 0.8 ? '🟢' : 
                           response.confidence >= 0.6 ? '🟡' : '🔴';
    formatted += ` | 可信度：${confidenceEmoji} ${Math.round(response.confidence * 100)}%`;
  }

  if (cached) {
    formatted += ' | ⚡ 缓存响应';
  }

  // 包含详细元数据
  if (includeMetadata && response.metadata) {
    formatted += '\n\n**详细信息：**';
    formatted += `\n- 处理时间：${executionTime}ms`;
    formatted += `\n- 模型：${response.metadata.model}`;
    if (response.metadata.tokens) {
      formatted += `\n- Token使用：输入${response.metadata.tokens.input} / 输出${response.metadata.tokens.output}`;
    }
    formatted += `\n- 员工ID：${response.employeeId}`;
  }

  // 添加使用建议
  if (response.suggestions && response.suggestions.length > 0) {
    formatted += '\n\n💡 **优化建议：**\n' + response.suggestions.map(s => `- ${s}`).join('\n');
  }

  return formatted;
}

/**
 * chimech/ask工具定义
 */
export const chimechAskTool: ChiMechTool = {
  name: 'chimech/ask',
  description: `与千机阁数字员工对话，获得专业的问题解答和建议。

这是千机阁MCP服务器的核心工具，可以：
• 智能路由到最适合的数字员工
• 提供高质量的专业回答
• 支持多种优先级和能力类型
• 自动缓存常见问题以提高响应速度
• 提供相关资料和问题建议

适用场景：
- 技术问题咨询和代码审查
- 业务策略分析和建议  
- 创意设计和用户体验
- 数据分析和洞察发现
- 项目管理和团队协作`,
  
  schema: ChiMechAskSchema,
  handler: handleChiMechAsk,
  
  metadata: {
    category: 'core',
    tags: ['问答', '智能路由', '多模态', '缓存'],
    version: '1.0.0',
    author: '千机阁团队',
    requiresAuth: true,
    rateLimited: true
  }
}; 