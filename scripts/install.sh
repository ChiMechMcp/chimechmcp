#!/bin/bash

# 千机阁MCP服务器一键安装脚本
# Usage: curl -fsSL https://install.chimech.com/mcp | bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_success() {
    print_message $GREEN "✅ $1"
}

print_error() {
    print_message $RED "❌ $1"
    exit 1
}

print_warning() {
    print_message $YELLOW "⚠️  $1"
}

print_info() {
    print_message $BLUE "ℹ️  $1"
}

print_step() {
    print_message $PURPLE "🔧 $1"
}

# 显示欢迎信息
show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════╗
    ║          千机阁 MCP 服务器              ║
    ║      ChiMech MCP Server Installer      ║
    ║                                       ║
    ║         https://chimech.com           ║
    ╚═══════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# 检查系统要求
check_requirements() {
    print_step "检查系统要求..."
    
    # 检查操作系统
    OS="$(uname)"
    case $OS in
        'Linux')
            OS='Linux'
            ;;
        'Darwin') 
            OS='Mac'
            ;;
        'MINGW'*|'MSYS'*|'CYGWIN'*)
            OS='Windows'
            ;;
        *)
            print_error "不支持的操作系统: $OS"
            ;;
    esac
    print_info "操作系统: $OS"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装。请先安装 Node.js 18+ (https://nodejs.org/)"
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -lt "18" ]; then
        print_error "Node.js 版本过低 ($NODE_VERSION)。需要 18.0.0 或更高版本"
    fi
    print_success "Node.js 版本: v$NODE_VERSION"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
    fi
    
    NPM_VERSION=$(npm --version)
    print_success "npm 版本: $NPM_VERSION"
}

# 获取安装方式
get_install_method() {
    print_step "选择安装方式..."
    
    echo "请选择安装方式:"
    echo "1) 全局安装 (推荐)"
    echo "2) 项目安装"
    echo "3) 开发版本"
    
    while true; do
        read -p "请输入选择 (1-3): " choice
        case $choice in
            1)
                INSTALL_METHOD="global"
                break
                ;;
            2)
                INSTALL_METHOD="local"
                break
                ;;
            3)
                INSTALL_METHOD="dev"
                break
                ;;
            *)
                print_warning "无效选择，请输入1-3"
                ;;
        esac
    done
    
    print_info "安装方式: $INSTALL_METHOD"
}

# 安装MCP服务器
install_mcp_server() {
    print_step "安装千机阁MCP服务器..."
    
    case $INSTALL_METHOD in
        "global")
            print_info "全局安装..."
            npm install -g @chimech/mcp-server
            ;;
        "local")
            print_info "项目安装..."
            if [ ! -f "package.json" ]; then
                npm init -y
            fi
            npm install @chimech/mcp-server
            ;;
        "dev")
            print_info "开发版本安装..."
            git clone https://github.com/chimech/chimechmcp.git
            cd chimechmcp
            npm install
            npm run build
            npm link
            ;;
    esac
    
    print_success "MCP服务器安装完成"
}

# 配置API密钥
configure_api_key() {
    print_step "配置API密钥..."
    
    echo ""
    print_info "您需要一个千机阁API密钥来使用服务"
    print_info "请访问 https://app.chimech.com 获取API密钥"
    echo ""
    
    while true; do
        read -p "请输入您的API密钥 (留空跳过): " API_KEY
        
        if [ -z "$API_KEY" ]; then
            print_warning "跳过API密钥配置，您可以稍后手动配置"
            break
        fi
        
        # 简单验证API密钥格式
        if [[ ${#API_KEY} -lt 32 ]]; then
            print_warning "API密钥似乎太短，请检查是否正确"
            continue
        fi
        
        # 创建环境变量文件
        cat > .env << EOF
# 千机阁MCP服务器配置
CHIMECH_API_KEY=$API_KEY
CHIMECH_SERVER_URL=https://api.chimech.com
LOG_LEVEL=info
CACHE_TTL=300
REQUEST_TIMEOUT=30000
RETRY_COUNT=3
MAX_CONCURRENT_REQUESTS=5
EOF
        
        print_success "API密钥配置完成"
        break
    done
}

# 检测客户端并生成配置
configure_clients() {
    print_step "检测并配置MCP客户端..."
    
    # 检测Cursor
    if command -v cursor &> /dev/null || [ -d "$HOME/.cursor" ]; then
        print_info "检测到 Cursor IDE"
        configure_cursor
    fi
    
    # 检测Claude Desktop
    if [ -f "$HOME/.claude/config.json" ] || [ -f "$HOME/Library/Application Support/Claude/config.json" ]; then
        print_info "检测到 Claude Desktop"
        configure_claude_desktop
    fi
    
    # 检测Cherry Studio  
    if [ -d "$HOME/.cherry-studio" ]; then
        print_info "检测到 Cherry Studio"
        configure_cherry_studio
    fi
}

# 配置Cursor
configure_cursor() {
    local cursor_config="$HOME/.cursor/mcp_servers.json"
    
    if [ -f "$cursor_config" ]; then
        print_info "备份现有Cursor配置..."
        cp "$cursor_config" "$cursor_config.backup.$(date +%s)"
    fi
    
    mkdir -p "$(dirname "$cursor_config")"
    
    cat > "$cursor_config" << 'EOF'
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
EOF

    if [ -n "$API_KEY" ]; then
        # 使用实际API密钥替换
        if command -v sed &> /dev/null; then
            sed -i.bak "s/your-api-key-here/$API_KEY/g" "$cursor_config"
            rm "$cursor_config.bak" 2>/dev/null || true
        fi
    fi
    
    print_success "Cursor配置完成: $cursor_config"
}

# 配置Claude Desktop
configure_claude_desktop() {
    local claude_config_dir
    
    case $OS in
        'Mac')
            claude_config_dir="$HOME/Library/Application Support/Claude"
            ;;
        'Linux')
            claude_config_dir="$HOME/.config/claude"
            ;;
        'Windows')
            claude_config_dir="$APPDATA/Claude"
            ;;
    esac
    
    local claude_config="$claude_config_dir/claude_desktop_config.json"
    
    mkdir -p "$claude_config_dir"
    
    if [ -f "$claude_config" ]; then
        print_info "备份现有Claude Desktop配置..."
        cp "$claude_config" "$claude_config.backup.$(date +%s)"
    fi
    
    cat > "$claude_config" << EOF
{
  "mcpServers": {
    "chimech": {
      "command": "npx",
      "args": ["@chimech/mcp-server"],
      "env": {
        "CHIMECH_API_KEY": "${API_KEY:-your-api-key-here}",
        "CHIMECH_SERVER_URL": "https://api.chimech.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF
    
    print_success "Claude Desktop配置完成: $claude_config"
}

# 配置Cherry Studio
configure_cherry_studio() {
    local cherry_config="$HOME/.cherry-studio/mcp.json"
    
    mkdir -p "$(dirname "$cherry_config")"
    
    cat > "$cherry_config" << EOF
{
  "servers": [
    {
      "name": "chimech",
      "command": "npx",
      "args": ["@chimech/mcp-server"],
      "env": {
        "CHIMECH_API_KEY": "${API_KEY:-your-api-key-here}",
        "CHIMECH_SERVER_URL": "https://api.chimech.com",
        "LOG_LEVEL": "info"
      }
    }
  ]
}
EOF
    
    print_success "Cherry Studio配置完成: $cherry_config"
}

# 运行健康检查
run_health_check() {
    print_step "运行健康检查..."
    
    if [ -z "$API_KEY" ]; then
        print_warning "跳过健康检查 (未配置API密钥)"
        return
    fi
    
    # 尝试运行健康检查
    if command -v chimech-mcp &> /dev/null; then
        if chimech-mcp health 2>/dev/null; then
            print_success "健康检查通过"
        else
            print_warning "健康检查失败，但服务器已安装"
        fi
    else
        print_warning "无法运行健康检查，请手动验证"
    fi
}

# 显示完成信息
show_completion() {
    print_success "千机阁MCP服务器安装完成！"
    
    echo ""
    print_info "📋 安装摘要:"
    echo "   • 安装方式: $INSTALL_METHOD"
    echo "   • 操作系统: $OS"
    if [ -n "$API_KEY" ]; then
        echo "   • API密钥: 已配置"
    else
        echo "   • API密钥: 待配置"
    fi
    
    echo ""
    print_info "🚀 快速开始:"
    if [ -z "$API_KEY" ]; then
        echo "1. 配置API密钥:"
        echo "   export CHIMECH_API_KEY='your-api-key'"
    else
        echo "1. API密钥已配置 ✅"
    fi
    
    echo "2. 测试连接:"
    echo "   chimech-mcp health"
    
    echo "3. 查看状态:"
    echo "   chimech-mcp status"
    
    echo ""
    print_info "📚 更多信息:"
    echo "   • 文档: https://docs.chimech.com"
    echo "   • GitHub: https://github.com/chimech/chimechmcp"
    echo "   • 支持: https://chimech.com/support"
    
    echo ""
    print_info "💡 提示: 重启您的MCP客户端以加载新配置"
}

# 主函数
main() {
    show_banner
    check_requirements
    get_install_method
    install_mcp_server
    configure_api_key
    configure_clients
    run_health_check
    show_completion
}

# 错误处理
trap 'print_error "安装过程中发生错误"' ERR

# 运行安装
main "$@" 