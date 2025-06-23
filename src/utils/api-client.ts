/**
 * 千机阁API客户端封装
 */

import fetch, { Response } from 'node-fetch';
import type { 
  ChiMechApiClient,
  ChiMechApiRequest,
  ChiMechApiResponse,
  DigitalEmployee,
  ChiMechConfig,
  Logger
} from '@/types';
import { ChiMechError, AuthenticationError, RateLimitError } from '@/types';
import { logger } from '@/utils/logger';

/**
 * HTTP重试机制
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    
    // 指数退避
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
}

/**
 * 智能员工路由引擎
 */
export class EmployeeRouter {
  constructor(private employees: DigitalEmployee[]) {}

  /**
   * 根据问题选择最适合的员工
   */
  selectBestEmployee(
    question: string,
    context?: string,
    capabilities?: string[]
  ): DigitalEmployee | null {
    if (this.employees.length === 0) {
      return null;
    }

    // 计算每个员工的适配分数
    const scores = this.employees.map(employee => ({
      employee,
      score: this.calculateEmployeeScore(employee, question, context, capabilities)
    }));

    // 选择分数最高的员工
    scores.sort((a, b) => b.score - a.score);
    
    const bestMatch = scores[0];
    return bestMatch.score > 0 ? bestMatch.employee : this.employees[0];
  }

  /**
   * 计算员工适配分数
   */
  private calculateEmployeeScore(
    employee: DigitalEmployee,
    question: string,
    context?: string,
    requiredCapabilities?: string[]
  ): number {
    if (employee.status !== 'active') {
      return 0;
    }

    let score = 1; // 基础分数

    // 专业领域匹配
    const questionLower = question.toLowerCase();
    const contextLower = context?.toLowerCase() || '';
    
    for (const expertise of employee.expertise) {
      if (questionLower.includes(expertise.toLowerCase()) || 
          contextLower.includes(expertise.toLowerCase())) {
        score += 2;
      }
    }

    // 能力匹配
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const employeeCapabilityTypes = employee.capabilities.map(c => c.type);
      const matchedCapabilities = requiredCapabilities.filter(cap => 
        employeeCapabilityTypes.includes(cap as any)
      );
      score += matchedCapabilities.length * 1.5;
    }

    // 经验等级加权
    const expertiseBonus = employee.capabilities.reduce((bonus, cap) => {
      if (cap.level === 'expert') return bonus + 1;
      if (cap.level === 'senior') return bonus + 0.5;
      return bonus;
    }, 0);
    
    score += expertiseBonus;

    // 角色特定匹配
    const roleKeywords = {
      '技术专家': ['代码', '编程', '开发', '架构', '技术', '算法', 'bug', '性能'],
      '业务顾问': ['商务', '销售', '市场', '策略', '客户', '业务', '营销'],
      '创意设计师': ['设计', '创意', '美术', '视觉', 'UI', 'UX', '品牌'],
      '数据分析师': ['数据', '分析', '统计', '报表', '指标', '洞察'],
      '项目经理': ['项目', '管理', '协调', '计划', '进度', '团队']
    };

    const roleMatches = roleKeywords[employee.role] || [];
    for (const keyword of roleMatches) {
      if (questionLower.includes(keyword) || contextLower.includes(keyword)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * 获取所有可用员工
   */
  getAvailableEmployees(): DigitalEmployee[] {
    return this.employees.filter(emp => emp.status === 'active');
  }

  /**
   * 按专业领域分组员工
   */
  groupEmployeesByExpertise(): Record<string, DigitalEmployee[]> {
    const groups: Record<string, DigitalEmployee[]> = {};
    
    for (const employee of this.employees) {
      for (const expertise of employee.expertise) {
        if (!groups[expertise]) {
          groups[expertise] = [];
        }
        groups[expertise].push(employee);
      }
    }
    
    return groups;
  }
}

/**
 * 千机阁API客户端实现
 */
export class ChiMechApiClientImpl implements ChiMechApiClient {
  private router: EmployeeRouter;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(
    private config: ChiMechConfig,
    private clientLogger: Logger = logger
  ) {
    this.baseUrl = config.serverUrl.replace(/\/$/, '');
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': `ChiMech-MCP-Client/1.0.0 (${config.clientType || 'unknown'})`
    };
    
    // 初始化空的路由器，待获取员工列表后更新
    this.router = new EmployeeRouter([]);
  }

  /**
   * 处理用户请求
   */
  async processRequest(request: ChiMechApiRequest): Promise<ChiMechApiResponse> {
    this.clientLogger.debug('[API] Processing request', { 
      question: request.question.substring(0, 100),
      priority: request.priority 
    });

    return retryRequest(async () => {
      // 智能路由选择员工
      const selectedEmployee = this.router.selectBestEmployee(
        request.question,
        request.context,
        request.capabilities
      );

      const employeeId = request.employeeId || selectedEmployee?.id;

      // 构建API请求
      const apiRequest = {
        ...request,
        employeeId,
        metadata: {
          ...request.metadata,
          clientType: this.config.clientType,
          workspaceId: this.config.workspaceId,
          teamId: this.config.teamId,
          timestamp: new Date().toISOString()
        }
      };

      const response = await this.makeHttpRequest('POST', '/v1/chat/completions', apiRequest);
      
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json() as any;
      
      this.clientLogger.debug('[API] Request completed', {
        employeeId: data.employeeId,
        processingTime: data.metadata?.processingTime
      });

      return data;
    }, this.config.retryCount);
  }

  /**
   * 获取员工列表
   */
  async listEmployees(): Promise<DigitalEmployee[]> {
    this.clientLogger.debug('[API] Fetching employee list');

    return retryRequest(async () => {
      const response = await this.makeHttpRequest('GET', '/v1/employees');
      
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json() as any;
      const employees = data.employees || [];
      
      // 更新路由器
      this.router = new EmployeeRouter(employees);
      
      this.clientLogger.info('[API] Employee list updated', { 
        count: employees.length 
      });

      return employees;
    }, this.config.retryCount);
  }

  /**
   * 获取特定员工信息
   */
  async getEmployee(id: string): Promise<DigitalEmployee> {
    this.clientLogger.debug('[API] Fetching employee', { employeeId: id });

    return retryRequest(async () => {
      const response = await this.makeHttpRequest('GET', `/v1/employees/${id}`);
      
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json() as any;
      return data.employee;
    }, this.config.retryCount);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      const response = await this.makeHttpRequest('GET', '/v1/health', null, 5000);
      
      if (response.ok) {
        const data = await response.json() as any;
        return {
          status: 'ok',
          message: data.message || 'API connection healthy'
        };
      } else {
        return {
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取路由器实例（用于测试和调试）
   */
  getRouter(): EmployeeRouter {
    return this.router;
  }

  /**
   * 执行HTTP请求
   */
  private async makeHttpRequest(
    method: string,
    path: string,
    body?: any,
    timeout?: number
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const requestTimeout = timeout || this.config.timeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ChiMechError(
          `Request timeout after ${requestTimeout}ms`,
          'REQUEST_TIMEOUT',
          408
        );
      }
      throw error;
    }
  }

  /**
   * 处理HTTP错误
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = 'HTTP_ERROR';
    let errorDetails: any = undefined;

    try {
      const errorData = await response.json() as any;
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code || errorCode;
      errorDetails = errorData.details;
    } catch {
      // 忽略JSON解析错误，使用默认错误信息
    }

    // 特定错误类型处理
    if (response.status === 401) {
      throw new AuthenticationError(errorMessage);
    }
    
    if (response.status === 429) {
      throw new RateLimitError(errorMessage);
    }

    throw new ChiMechError(errorMessage, errorCode, response.status, errorDetails);
  }
}

/**
 * 创建API客户端实例
 */
export function createApiClient(config: ChiMechConfig, logger?: Logger): ChiMechApiClient {
  return new ChiMechApiClientImpl(config, logger);
} 