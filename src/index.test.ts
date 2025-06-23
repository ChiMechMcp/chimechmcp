/**
 * 千机阁MCP服务器 - 基础测试
 */

describe('千机阁MCP服务器', () => {
  test('基础健康检查', () => {
    expect(true).toBe(true);
  });

  test('项目配置验证', () => {
    const pkg = require('../package.json');
    
    expect(pkg.name).toBe('chimech-mcp-server');
    expect(pkg.description).toContain('千机阁');
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.bin['chimech-mcp']).toBe('dist/cli.js');
  });

  test('版本号格式验证', () => {
    const pkg = require('../package.json');
    const versionRegex = /^\d+\.\d+\.\d+$/;
    
    expect(pkg.version).toMatch(versionRegex);
  });
}); 