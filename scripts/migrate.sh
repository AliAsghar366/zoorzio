#!/bin/bash

# Anchor Database Migration Script
# This script handles database migrations

set -e

echo "🗄️  Anchor Database Migration Script"

# Configuration
ENVIRONMENT=${1:-production}
ACTION=${2:-migrate}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info > /dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Run migrations
    kubectl exec -it $API_POD -n anchor -- sh -c 'cd packages/database && npx prisma migrate deploy'
    
    log_info "Database migrations completed"
}

# Generate Prisma client
generate_client() {
    log_info "Generating Prisma client..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Generate client
    kubectl exec -it $API_POD -n anchor -- sh -c 'cd packages/database && npx prisma generate'
    
    log_info "Prisma client generated"
}

# Create migration
create_migration() {
    log_info "Creating new migration..."
    
    # Get migration name
    read -p "Enter migration name: " MIGRATION_NAME
    
    if [ -z "$MIGRATION_NAME" ]; then
        log_error "Migration name is required"
        exit 1
    fi
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Create migration
    kubectl exec -it $API_POD -n anchor -- sh -c "cd packages/database && npx prisma migrate dev --name $MIGRATION_NAME"
    
    log_info "Migration created: $MIGRATION_NAME"
}

# Reset database
reset_database() {
    log_info "Resetting database..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Reset database
    kubectl exec -it $API_POD -n anchor -- sh -c 'cd packages/database && npx prisma migrate reset --force'
    
    log_info "Database reset completed"
}

# Seed database
seed_database() {
    log_info "Seeding database..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Seed database
    kubectl exec -it $API_POD -n anchor -- sh -c 'cd packages/database && npx prisma db seed'
    
    log_info "Database seeded"
}

# Check migration status
check_status() {
    log_info "Checking migration status..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Check status
    kubectl exec -it $API_POD -n anchor -- sh -c 'cd packages/database && npx prisma migrate status'
    
    log_info "Migration status checked"
}

# Main function
main() {
    log_info "Starting database migration for ${ENVIRONMENT}..."
    
    check_prerequisites
    
    case $ACTION in
        migrate)
            run_migrations
            ;;
        generate)
            generate_client
            ;;
        create)
            create_migration
            ;;
        reset)
            reset_database
            ;;
        seed)
            seed_database
            ;;
        status)
            check_status
            ;;
        *)
            log_error "Unknown action: $ACTION"
            echo "Usage: $0 <environment> <action>"
            echo "Actions: migrate, generate, create, reset, seed, status"
            exit 1
            ;;
    esac
    
    log_info "✅ Database migration completed!"
}

# Run main function
main
