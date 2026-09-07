#!/bin/bash

# Anchor Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up Anchor development environment..."

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        echo "❌ Node.js version must be 18+. Current version: $(node -v)"
        exit 1
    fi
    echo "✅ Node.js $(node -v)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed"
        exit 1
    fi
    echo "✅ npm $(npm -v)"
    
    # Check Python
    if ! command -v python &> /dev/null; then
        echo "❌ Python is not installed. Please install Python 3.10+"
        exit 1
    fi
    echo "✅ Python $(python --version | cut -d' ' -f2)"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "⚠️  Docker is not installed. Some features may not work."
    else
        echo "✅ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
    fi
    
    # Check pnpm (optional)
    if command -v pnpm &> /dev/null; then
        echo "✅ pnpm $(pnpm -v)"
    else
        echo "ℹ️  pnpm not found. Using npm instead."
    fi
}

# Install dependencies
install_dependencies() {
    echo ""
    echo "📦 Installing dependencies..."
    
    # Root + workspace dependencies (apps/api, apps/web, apps/mobile,
    # packages/*) - these share cross-package dependencies (e.g. apps/api
    # depends on @anchor/database), so they must be installed together as
    # one npm workspaces install rather than one `npm install` per app.
    echo "Installing workspace dependencies..."
    npm install

    # AI dependencies
    echo "Installing AI dependencies..."
    cd apps/ai
    if command -v pip &> /dev/null; then
        pip install -r requirements.txt
    else
        echo "⚠️  pip not found. Please install Python dependencies manually."
    fi
    cd ../..
}

# Setup environment
setup_environment() {
    echo ""
    echo "🔧 Setting up environment..."
    
    # Copy .env.example to .env if it doesn't exist
    if [ ! -f apps/api/.env ]; then
        cp apps/api/.env.example apps/api/.env
        echo "✅ Created apps/api/.env from .env.example"
        echo "⚠️  Please update apps/api/.env with your configuration"
    else
        echo "ℹ️  apps/api/.env already exists"
    fi
}

# Setup database
setup_database() {
    echo ""
    echo "🗄️  Setting up database..."
    
    cd packages/database

    # Check if prisma is installed
    if command -v npx &> /dev/null; then
        echo "Generating Prisma client..."
        npx prisma generate --schema=./prisma/schema.prisma

        echo "Running migrations..."
        npx prisma migrate dev --name init --schema=./prisma/schema.prisma

        echo "Seeding database..."
        npx prisma db seed --schema=./prisma/schema.prisma || echo "⚠️  Seeding failed (this is okay for initial setup)"
    else
        echo "⚠️  npx not found. Please run Prisma commands manually."
    fi

    cd ../..
}

# Start services
start_services() {
    echo ""
    echo "🚀 Starting services..."
    
    # Check if Docker is available
    if command -v docker-compose &> /dev/null; then
        echo "Starting Docker services..."
        cd infrastructure/docker
        docker-compose up -d postgres redis
        cd ../..
        
        echo "Waiting for services to start..."
        sleep 10
    else
        echo "⚠️  Docker Compose not found. Please start PostgreSQL and Redis manually."
    fi
}

# Main setup
main() {
    echo "=========================================="
    echo "  Anchor - The Memory Layer"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    install_dependencies
    setup_environment
    setup_database
    start_services
    
    echo ""
    echo "=========================================="
    echo "✅ Setup complete!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Update apps/api/.env with your API keys"
    echo "2. Start the API server: cd apps/api && npm run start:dev"
    echo "3. Start the web dashboard: cd apps/web && npm run dev"
    echo "4. Start the AI services: cd apps/ai && python main.py"
    echo ""
    echo "For mobile development:"
    echo "  cd apps/mobile && npm start"
    echo ""
    echo "API documentation will be available at:"
    echo "  http://localhost:3000/api/docs"
    echo ""
    echo "Happy coding! 🎉"
}

# Run main function
main
