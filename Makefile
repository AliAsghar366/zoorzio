# Anchor Makefile
# Common development commands

.PHONY: help install dev test build deploy clean

# Default target
help:
	@echo "Anchor - The Memory Layer"
	@echo "========================"
	@echo ""
	@echo "Available commands:"
	@echo "  make install     - Install all dependencies"
	@echo "  make dev         - Start development servers"
	@echo "  make test        - Run all tests"
	@echo "  make build       - Build all applications"
	@echo "  make deploy      - Deploy to production"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make lint        - Run linters"
	@echo "  make format      - Format code"
	@echo "  make docker-up   - Start Docker services"
	@echo "  make docker-down - Stop Docker services"
	@echo "  make db-migrate  - Run database migrations"
	@echo "  make db-seed     - Seed database"
	@echo "  make docs        - Generate API documentation"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install
	cd apps/api && npm install
	cd apps/web && npm install
	cd apps/mobile && npm install
	cd apps/ai && pip install -r requirements.txt

# Start development servers
dev:
	@echo "Starting development servers..."
	@echo "Starting API server..."
	cd apps/api && npm run start:dev &
	@echo "Starting web dashboard..."
	cd apps/web && npm run dev &
	@echo "Starting AI services..."
	cd apps/ai && python main.py &
	@echo "All servers started!"
	@echo "API: http://localhost:3000"
	@echo "Web: http://localhost:3001"
	@echo "AI: http://localhost:8000"

# Run tests
test:
	@echo "Running API tests..."
	cd apps/api && npm run test
	@echo "Running web tests..."
	cd apps/web && npm run test
	@echo "Running AI tests..."
	cd apps/ai && python -m pytest tests/

# Run tests with coverage
test-cov:
	@echo "Running API tests with coverage..."
	cd apps/api && npm run test:cov
	@echo "Running AI tests with coverage..."
	cd apps/ai && python -m pytest tests/ --cov=.

# Build applications
build:
	@echo "Building API..."
	cd apps/api && npm run build
	@echo "Building web..."
	cd apps/web && npm run build
	@echo "Building mobile..."
	cd apps/mobile && npm run build

# Deploy to production
deploy:
	@echo "Deploying to production..."
	./scripts/deploy.sh

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf apps/api/dist
	rm -rf apps/web/.next
	rm -rf apps/web/out
	rm -rf apps/mobile/dist
	rm -rf node_modules
	rm -rf apps/api/node_modules
	rm -rf apps/web/node_modules
	rm -rf apps/mobile/node_modules
	@echo "Clean complete!"

# Run linters
lint:
	@echo "Linting API..."
	cd apps/api && npm run lint
	@echo "Linting web..."
	cd apps/web && npm run lint

# Format code
format:
	@echo "Formatting code..."
	cd apps/api && npm run format
	cd apps/web && npm run format

# Start Docker services
docker-up:
	@echo "Starting Docker services..."
	cd infrastructure/docker && docker-compose up -d
	@echo "Waiting for services..."
	sleep 10
	@echo "Docker services started!"

# Stop Docker services
docker-down:
	@echo "Stopping Docker services..."
	cd infrastructure/docker && docker-compose down

# Run database migrations
db-migrate:
	@echo "Running database migrations..."
	cd packages/database && npx prisma migrate dev --schema=./prisma/schema.prisma

# Seed database
db-seed:
	@echo "Seeding database..."
	cd packages/database && npm run seed

# Generate API documentation
docs:
	@echo "Generating API documentation..."
	cd apps/api && npm run build
	@echo "API docs available at: http://localhost:3000/api/docs"

# Docker build
docker-build:
	@echo "Building Docker images..."
	docker build -t anchor/api:latest -f apps/api/Dockerfile .
	docker build -t anchor/ai:latest -f apps/ai/Dockerfile .

# Security scan
security:
	@echo "Running security scan..."
	cd apps/api && npm audit
	cd apps/web && npm audit
	cd apps/ai && safety check

# Performance test
perf:
	@echo "Running performance tests..."
	# Add performance testing tools here

# Database backup
db-backup:
	@echo "Creating database backup..."
	pg_dump -h localhost -U postgres anchor > backup_$(date +%Y%m%d_%H%M%S).sql

# Database restore
db-restore:
	@echo "Restoring database..."
	psql -h localhost -U postgres anchor < $(BACKUP_FILE)

# Logs
logs:
	@echo "Showing Docker logs..."
	cd infrastructure/docker && docker-compose logs -f

# Status
status:
	@echo "Checking service status..."
	@curl -s http://localhost:3000/health | jq .
	@echo ""
	@docker ps | grep anchor
