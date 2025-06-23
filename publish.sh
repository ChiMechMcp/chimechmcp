#!/bin/bash

# 千机阁MCP服务器发布脚本
# 自动化构建、测试和发布流程

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="千机阁MCP服务器"
PACKAGE_NAME="@chimech/mcp-server"
MIN_NODE_VERSION=18

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# 检查必要工具
check_dependencies() {
    log_step "检查依赖工具..."
    
    local missing_tools=()
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js")
    else
        node_version=$(node --version)
        log_info "Node.js 版本: $node_version"
        
        # 检查 Node.js 版本是否符合要求 (18+)
        node_major=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_major" -lt $MIN_NODE_VERSION ]; then
            log_error "Node.js 版本过低，需要 ${MIN_NODE_VERSION}.0.0 或更高版本"
            exit 1
        fi
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    else
        npm_version=$(npm --version)
        log_info "npm 版本: $npm_version"
    fi
    
    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    else
        git_version=$(git --version)
        log_info "$git_version"
    fi
    
    # 检查TypeScript编译器
    if ! command -v tsc &> /dev/null && ! npx tsc --version &> /dev/null; then
        log_warning "TypeScript 编译器未全局安装，将使用项目本地版本"
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "缺少必要工具: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "所有依赖工具已安装"
}

# 检查项目根目录
check_project_root() {
    log_step "检查项目根目录..."
    
    if [ ! -f "package.json" ]; then
        log_error "未找到 package.json，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 验证项目名称
    current_package=$(node -p "require('./package.json').name")
    if [ "$current_package" != "$PACKAGE_NAME" ]; then
        log_error "项目名称不匹配，期望: $PACKAGE_NAME，实际: $current_package"
        exit 1
    fi
    
    # 检查项目结构
    local missing_dirs=()
    
    if [ ! -d "src" ]; then
        missing_dirs+=("src")
    fi
    
    if [ ! -f "src/index.ts" ]; then
        missing_dirs+=("src/index.ts")
    fi
    
    if [ ! -f "src/cli.ts" ]; then
        missing_dirs+=("src/cli.ts")
    fi
    
    if [ ! -f "tsconfig.json" ]; then
        missing_dirs+=("tsconfig.json")
    fi
    
    if [ ${#missing_dirs[@]} -ne 0 ]; then
        log_error "项目结构不完整，缺少: ${missing_dirs[*]}"
        exit 1
    fi
    
    log_success "项目根目录检查通过"
}

# 检查工作区状态
check_workspace() {
    log_step "检查工作区状态..."
    
    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        log_warning "工作区有未提交的更改"
        git status --porcelain
        echo
        read -p "是否继续发布? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "发布已取消"
            exit 0
        fi
    fi
    
    # 检查当前分支
    current_branch=$(git branch --show-current)
    log_info "当前分支: $current_branch"
    
    if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
        log_warning "当前不在主分支"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "发布已取消"
            exit 0
        fi
    fi
    
    # 检查是否是最新代码
    git fetch origin
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/$current_branch)" ]; then
        log_warning "本地代码不是最新的"
        read -p "是否先拉取最新代码? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            git pull origin "$current_branch"
            log_success "已拉取最新代码"
        fi
    fi
    
    log_success "工作区状态检查通过"
}

# 安装依赖
install_dependencies() {
    log_step "安装项目依赖..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    log_success "依赖安装完成"
}

# 代码质量检查
quality_check() {
    log_step "执行代码质量检查..."
    
    # TypeScript 类型检查
    log_info "执行 TypeScript 类型检查..."
    if npx tsc --noEmit; then
        log_success "类型检查通过"
    else
        log_error "类型检查失败"
        exit 1
    fi
    
    # ESLint 代码检查
    if npm run lint; then
        log_success "代码检查通过"
    else
        log_warning "代码检查发现问题"
        read -p "是否尝试自动修复? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            npm run lint:fix
            log_info "已尝试自动修复，请检查结果"
        fi
    fi
    
    # Prettier 格式检查
    log_info "执行代码格式检查..."
    if npm run format; then
        log_success "代码格式化完成"
    else
        log_warning "代码格式化失败"
    fi
    
    log_success "代码质量检查完成"
}

# 运行测试
run_tests() {
    log_step "运行测试套件..."
    
    # 运行单元测试和集成测试
    if npm test; then
        log_success "所有测试通过"
    else
        log_error "测试失败，发布中止"
        
        # 询问是否查看覆盖率报告
        read -p "是否生成测试覆盖率报告? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm run test:coverage
        fi
        
        exit 1
    fi
    
    # 可选：生成覆盖率报告
    read -p "是否生成测试覆盖率报告? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run test:coverage
        log_info "覆盖率报告已生成"
    fi
}

# 构建项目
build_project() {
    log_step "构建项目..."
    
    # 清理旧的构建文件
    log_info "清理旧的构建文件..."
    npm run clean
    
    # 执行构建
    log_info "执行 TypeScript 编译..."
    if npm run build; then
        log_success "构建完成"
    else
        log_error "构建失败"
        exit 1
    fi
    
    # 检查构建输出
    if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
        log_error "构建输出不完整，缺少关键文件"
        exit 1
    fi
    
    # 检查CLI文件
    if [ ! -f "dist/cli.js" ]; then
        log_error "CLI构建文件不存在"
        exit 1
    fi
    
    # 验证构建文件可执行
    log_info "验证构建文件..."
    if node dist/index.js --version &> /dev/null || node dist/cli.js --version &> /dev/null; then
        log_success "构建文件验证通过"
    else
        log_warning "构建文件验证失败，但继续发布流程"
    fi
}

# 版本管理
manage_version() {
    log_step "管理版本..."
    
    # 获取当前版本
    current_version=$(node -p "require('./package.json').version")
    log_info "当前版本: $current_version"
    
    # 计算可能的新版本
    patch_version=$(npm version patch --dry-run 2>/dev/null | sed 's/v//' || echo "")
    minor_version=$(npm version minor --dry-run 2>/dev/null | sed 's/v//' || echo "")
    major_version=$(npm version major --dry-run 2>/dev/null | sed 's/v//' || echo "")
    
    # 如果无法获取版本，手动计算
    if [ -z "$patch_version" ]; then
        IFS='.' read -ra VERSION_PARTS <<< "$current_version"
        patch_version="${VERSION_PARTS[0]}.${VERSION_PARTS[1]}.$((${VERSION_PARTS[2]} + 1))"
        minor_version="${VERSION_PARTS[0]}.$((${VERSION_PARTS[1]} + 1)).0"
        major_version="$((${VERSION_PARTS[0]} + 1)).0.0"
    fi
    
    # 询问版本类型
    echo
    echo "选择版本更新类型:"
    echo "1) patch (修复) - $current_version -> $patch_version"
    echo "2) minor (功能) - $current_version -> $minor_version"
    echo "3) major (重大) - $current_version -> $major_version"
    echo "4) 跳过版本更新"
    echo
    
    read -p "请选择 (1-4): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            new_version=$(npm version patch --no-git-tag-version)
            log_success "版本已更新为: $new_version"
            version_updated=true
            ;;
        2)
            new_version=$(npm version minor --no-git-tag-version)
            log_success "版本已更新为: $new_version"
            version_updated=true
            ;;
        3)
            new_version=$(npm version major --no-git-tag-version)
            log_success "版本已更新为: $new_version"
            version_updated=true
            ;;
        4)
            log_info "跳过版本更新"
            new_version="v$current_version"
            version_updated=false
            ;;
        *)
            log_error "无效选择"
            exit 1
            ;;
    esac
}

# 发布前检查
pre_publish_check() {
    log_step "执行发布前检查..."
    
    # 检查 package.json 必要字段
    log_info "检查 package.json 配置..."
    if ! node -e "
        const pkg = require('./package.json');
        const required = ['name', 'version', 'description', 'main', 'bin'];
        const missing = required.filter(field => !pkg[field]);
        if (missing.length > 0) {
            console.error('缺少必要字段:', missing.join(', '));
            process.exit(1);
        }
        console.log('package.json 配置检查通过');
    "; then
        log_error "package.json 配置不完整"
        exit 1
    fi
    
    # 检查关键文件
    local missing_files=()
    
    if [ ! -f "README.md" ]; then
        missing_files+=("README.md")
    fi
    
    if [ ! -f "LICENSE" ]; then
        missing_files+=("LICENSE")
    fi
    
    if [ ! -f "CHANGELOG.md" ]; then
        missing_files+=("CHANGELOG.md")
    fi
    
    if [ ${#missing_files[@]} -ne 0 ]; then
        log_warning "缺少文件: ${missing_files[*]}"
        read -p "是否继续发布? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "发布已取消"
            exit 0
        fi
    fi
    
    # 检查 files 字段配置
    log_info "检查 package.json files 字段配置..."
    files_config=$(node -p "JSON.stringify(require('./package.json').files || [])")
    log_info "将发布的文件: $files_config"
    
    # 检查MCP服务器特定文件
    log_info "检查MCP服务器特定配置..."
    if [ ! -d "configs" ]; then
        log_warning "缺少配置目录 configs/"
    fi
    
    if [ ! -f "src/server/mcp-server.ts" ]; then
        log_warning "缺少MCP服务器核心文件"
    fi
    
    if [ ! -f "src/tools/chimech-ask.ts" ]; then
        log_warning "缺少核心工具文件"
    fi
    
    log_success "发布前检查完成"
}

# 发布到 npm
publish_to_npm() {
    log_step "发布到 npm..."
    
    # 检查是否已登录 npm
    if ! npm whoami &> /dev/null; then
        log_error "未登录 npm，请先运行 'npm login'"
        log_info "如果是首次发布，请确保已注册 npm 账号"
        exit 1
    fi
    
    local npm_user=$(npm whoami)
    log_info "当前 npm 用户: $npm_user"
    
    # 显示发布信息
    local package_name=$(node -p "require('./package.json').name")
    local package_version=$(node -p "require('./package.json').version")
    
    echo
    log_info "准备发布包信息:"
    echo "  包名: $package_name"
    echo "  版本: $package_version"
    echo "  用户: $npm_user"
    echo "  访问权限: public"
    echo
    
    # 检查版本是否已存在
    if npm view "$package_name@$package_version" version &> /dev/null; then
        log_error "版本 $package_version 已存在于 npm registry"
        exit 1
    fi
    
    # 确认发布
    read -p "确认发布到 npm? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "发布已取消"
        exit 0
    fi
    
    # 执行发布
    log_info "正在发布..."
    if npm publish; then
        log_success "发布成功: $package_name@$package_version"
        echo
        log_info "包地址: https://www.npmjs.com/package/$package_name"
    else
        log_error "发布失败"
        exit 1
    fi
}

# 创建 Git 标签并推送
create_git_tag() {
    if [ "$version_updated" = true ]; then
        log_step "创建 Git 标签..."
        
        local package_version=$(node -p "require('./package.json').version")
        local tag_name="v$package_version"
        
        # 提交版本更改
        git add package.json package-lock.json
        git commit -m "chore: 🔖 bump version to $package_version"
        
        # 创建标签
        git tag -a "$tag_name" -m "Release $tag_name

🚀 千机阁MCP服务器 $tag_name 版本发布

主要更新:
- 企业级MCP服务器实现
- 智能问答工具 chimech/ask
- 多客户端支持 (Cursor, Claude Desktop, Cherry Studio)
- 高性能缓存和路由系统

安装方式:
npm install -g $PACKAGE_NAME

使用方式:
chimech-mcp --help"
        
        log_success "已创建标签: $tag_name"
    fi
}

# 推送到 Git
push_to_git() {
    log_step "推送更改到 Git..."
    
    local current_branch=$(git branch --show-current)
    
    # 推送代码
    git push origin "$current_branch"
    
    # 推送标签
    git push origin --tags
    
    log_success "已推送到 Git 仓库"
}

# 生成安装脚本测试
test_install_script() {
    read -p "是否测试安装脚本? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_step "测试安装脚本..."
        
        if [ -f "scripts/install.sh" ]; then
            # 创建测试环境
            test_dir=$(mktemp -d)
            log_info "测试目录: $test_dir"
            
            # 复制安装脚本
            cp scripts/install.sh "$test_dir/"
            
            # 在测试目录中执行安装脚本
            cd "$test_dir"
            bash install.sh --dry-run
            cd - > /dev/null
            
            # 清理测试目录
            rm -rf "$test_dir"
            
            log_success "安装脚本测试完成"
        else
            log_warning "未找到安装脚本 scripts/install.sh"
        fi
    fi
}

# 清理临时文件
cleanup() {
    log_step "清理临时文件..."
    
    # 清理构建缓存
    if [ -d ".cache" ]; then
        rm -rf .cache
    fi
    
    # 清理测试报告
    if [ -f "junit.xml" ]; then
        rm -f junit.xml
    fi
    
    log_success "清理完成"
}

# 显示发布总结
show_summary() {
    local package_name=$(node -p "require('./package.json').name")
    local package_version=$(node -p "require('./package.json').version")
    
    echo
    echo "🎉 $PROJECT_NAME 发布完成！"
    echo "========================================"
    echo
    echo "📦 发布信息:"
    echo "  包名: $package_name"
    echo "  版本: $package_version"
    echo "  时间: $(date)"
    echo "  Node.js 要求: >= ${MIN_NODE_VERSION}.0.0"
    echo
    echo "🔗 相关链接:"
    echo "  NPM 包: https://www.npmjs.com/package/$package_name"
    echo "  GitHub: https://github.com/chimech/chimechmcp"
    echo "  安装命令: npm install -g $package_name"
    echo "  使用命令: chimech-mcp --help"
    echo
    echo "🚀 快速开始:"
    echo "  1. 全局安装: npm install -g $package_name"
    echo "  2. 配置API: chimech-mcp setup"
    echo "  3. 启动服务: chimech-mcp start"
    echo "  4. 健康检查: chimech-mcp health"
    echo
    echo "📋 后续步骤建议:"
    echo "  1. 更新 CHANGELOG.md 和发布说明"
    echo "  2. 通知团队成员新版本发布"
    echo "  3. 在 GitHub 创建 Release"
    echo "  4. 更新相关文档和示例"
    echo "  5. 收集用户反馈和改进建议"
    echo
    echo "💡 技术支持:"
    echo "  - 提交问题: https://github.com/chimech/chimechmcp/issues"
    echo "  - 参与讨论: https://github.com/chimech/chimechmcp/discussions"
    echo
}

# 主函数
main() {
    echo "🚀 开始 $PROJECT_NAME 发布流程..."
    echo "========================================"
    echo
    
    # 初始化变量
    version_updated=false
    
    # 执行发布流程
    check_dependencies
    check_project_root
    check_workspace
    install_dependencies
    quality_check
    run_tests
    build_project
    manage_version
    pre_publish_check
    publish_to_npm
    create_git_tag
    push_to_git
    test_install_script
    cleanup
    show_summary
}

# 错误处理
trap 'log_error "发布过程中出现错误 (退出码: $?)"; cleanup; exit 1' ERR

# 帮助信息
show_help() {
    echo "千机阁MCP服务器发布脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  --dry-run      预览发布流程，不实际执行"
    echo "  --skip-tests   跳过测试步骤"
    echo "  --skip-git     跳过Git操作"
    echo
    echo "示例:"
    echo "  $0                    # 完整发布流程"
    echo "  $0 --dry-run          # 预览发布流程"
    echo "  $0 --skip-tests       # 跳过测试"
    echo
}

# 参数处理
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --dry-run)
        log_info "预览模式：将显示发布流程但不实际执行"
        # 这里可以添加预览模式的逻辑
        exit 0
        ;;
    *)
        # 执行主函数
        main "$@"
        ;;
esac 