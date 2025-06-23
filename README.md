# 千机阁MCP服务器

> 🤖 将千机阁企业数字员工集成到您的开发工作流程中

[![npm version](https://img.shields.io/npm/v/@chimech/mcp-server)](https://www.npmjs.com/package/@chimech/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/chimech/chimechmcp)](https://github.com/chimech/chimechmcp/issues)

千机阁MCP服务器是一个完整的MCP（Model Context Protocol）服务器实现，让您可以在Cursor、Claude Desktop、Cherry Studio等IDE中直接使用千机阁的企业级数字员工服务。

## ✨ 特性

- 🤖 **智能员工路由** - 自动选择最适合的数字员工处理您的请求
- 🔧 **核心工具集** - 代码审查、架构设计、业务分析等专业工具
- ⚡ **高性能缓存** - 智能缓存机制，提升响应速度
- 🔒 **企业级安全** - API密钥认证、权限控制、审计日志
- 🌐 **多客户端支持** - 兼容主流MCP客户端
- 📊 **实时监控** - 完整的使用统计和健康监控
- 🚀 **一键部署** - 自动化安装和配置脚本

## 🚀 快速开始

### 方式一：一键安装（推荐）

```bash
curl -fsSL https://install.chimech.com/mcp | bash
```

### 方式二：手动安装

```bash
# 全局安装
npm install -g @chimech/mcp-server

# 或项目内安装
npm install @chimech/mcp-server
```

### 配置步骤

1. **获取API密钥**
   - 访问 [千机阁控制台](https://app.chimech.com)
   - 创建新的API密钥
   - 复制密钥备用

2. **配置环境变量**
   ```bash
   export CHIMECH_API_KEY="your-api-key-here"
   export CHIMECH_SERVER_URL="https://api.chimech.com"
   export LOG_LEVEL="info"
   ```

3. **配置MCP客户端**

   <details>
   <summary><strong>Cursor IDE</strong></summary>
   
   编辑 `~/.cursor/mcp_servers.json`：
   ```json
   {
     "mcpServers": {
       "chimech": {
         "command": "npx",
         "args": ["@chimech/mcp-server"],
         "env": {
           "CHIMECH_API_KEY": "your-api-key-here",
           "CHIMECH_SERVER_URL": "https://api.chimech.com",
           "LOG_LEVEL": "info"
         }
       }
     }
   }
   ```
   </details>

   <details>
   <summary><strong>Claude Desktop</strong></summary>
   
   编辑 `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) 或 
   `%APPDATA%\Claude\claude_desktop_config.json` (Windows)：
   ```json
   {
     "mcpServers": {
       "chimech": {
         "command": "npx",
         "args": ["@chimech/mcp-server"],
         "env": {
           "CHIMECH_API_KEY": "your-api-key-here",
           "CHIMECH_SERVER_URL": "https://api.chimech.com"
         }
       }
     }
   }
   ```
   </details>

   <details>
   <summary><strong>Cherry Studio</strong></summary>
   
   在Cherry Studio设置中添加MCP服务器配置。
   </details>

4. **验证安装**
   ```bash
   # 健康检查
   chimech-mcp health
   
   # 查看状态
   chimech-mcp status
   ```

## 🔧 核心工具

### `chimech/ask` - 智能问答

与千机阁数字员工进行专业对话，获得高质量的技术建议和解决方案。

**参数：**
- `question` (必需) - 您的问题或需求
- `context` (可选) - 提供额外的上下文信息
- `priority` (可选) - 优先级：`low`、`normal`、`high`
- `employeeId` (可选) - 指定特定的员工ID
- `capabilities` (可选) - 需要的能力类型
- `useCache` (可选) - 是否使用缓存，默认`true`
- `includeMetadata` (可选) - 是否包含详细元数据

**示例：**
```json
{
  "question": "如何优化这个React组件的性能？",
  "context": "这是一个显示大量数据的表格组件...",
  "priority": "normal",
  "capabilities": ["code-review", "architecture"]
}
```

**能力类型：**
- `code-review` - 代码审查和优化
- `architecture` - 系统架构设计
- `business` - 业务逻辑分析
- `creative` - 创意和设计
- `analysis` - 数据分析
- `support` - 技术支持

## 📖 使用场景

### 代码审查
```
问题：请帮我审查这段TypeScript代码
上下文：[粘贴您的代码]
能力：code-review
```

### 架构设计
```
问题：我需要设计一个高并发的用户系统
上下文：预计10万用户，需要支持实时聊天
能力：architecture
```

### 业务分析
```
问题：如何提高用户留存率？
上下文：SaaS产品，目前月留存率60%
能力：business, analysis
```

## 🛠️ 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/chimech/chimechmcp.git
cd chimechmcp

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑 .env 填入您的API密钥

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化代码
npm run format
```

### 项目结构

```
chimechmcp/
├── src/
│   ├── server/          # MCP服务器核心实现
│   ├── tools/           # MCP工具定义和处理
│   ├── utils/           # 工具函数和辅助类
│   ├── config/          # 配置管理
│   └── types/           # TypeScript类型定义
├── configs/             # 客户端配置模板
├── scripts/             # 部署和安装脚本
├── examples/            # 使用示例和演示
├── docs/               # 详细文档
└── tests/              # 测试文件
```

### 添加新工具

1. 在 `src/tools/` 目录下创建新工具文件
2. 实现工具的schema和handler
3. 在 `src/tools/index.ts` 中注册新工具
4. 添加相应的测试用例

参考现有的 `chimech-ask.ts` 实现。

## 📊 监控和调试

### 日志级别
- `debug` - 详细调试信息
- `info` - 一般信息（默认）
- `warn` - 警告信息
- `error` - 错误信息

### 性能监控
```bash
# 查看详细状态
chimech-mcp status

# 监控模式
chimech-mcp status --watch

# 导出统计数据
chimech-mcp stats --export stats.json
```

### 故障排除

<details>
<summary><strong>常见问题</strong></summary>

**连接失败**
- 检查API密钥是否正确
- 确认网络连接正常
- 查看日志文件排查具体错误

**性能问题**
- 启用缓存功能
- 调整超时和重试设置
- 检查并发请求数限制

**认证错误**
- 验证API密钥格式
- 检查密钥是否过期
- 确认权限设置正确
</details>

## 🤝 贡献

我们欢迎各种形式的贡献！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 创建Pull Request

### 贡献指南

- 遵循现有的代码风格
- 添加适当的测试用例
- 更新相关文档
- 确保CI检查通过

## 📋 变更日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的版本更新记录。

## 🆘 支持

### 获取帮助

- 📚 **文档**：[docs.chimech.com](https://docs.chimech.com)
- 💬 **社区**：[community.chimech.com](https://community.chimech.com)
- 🐛 **问题报告**：[GitHub Issues](https://github.com/chimech/chimechmcp/issues)
- 📧 **邮件支持**：[support@chimech.com](mailto:support@chimech.com)

### 企业支持

如需企业级支持服务，请联系我们：
- 📞 **电话**：400-xxx-xxxx
- 📧 **邮箱**：enterprise@chimech.com
- 🌐 **网站**：[chimech.com/enterprise](https://chimech.com/enterprise)

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详细信息。

## 🙏 致谢

感谢所有为本项目做出贡献的开发者和用户！

---

<div align="center">
  <strong>千机阁</strong> - 让每个企业都拥有自己的AI员工团队
  <br>
  <a href="https://chimech.com">官网</a> •
  <a href="https://docs.chimech.com">文档</a> •
  <a href="https://app.chimech.com">控制台</a> •
  <a href="https://community.chimech.com">社区</a>
</div>
