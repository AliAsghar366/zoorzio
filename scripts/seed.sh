#!/bin/bash

# Anchor Database Seed Script
# This script seeds the database with initial data

set -e

echo "🌱 Anchor Database Seed Script"

# Configuration
ENVIRONMENT=${1:-development}

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

# Seed database
seed_database() {
    log_info "Seeding database..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Run seed command
    kubectl exec -it $API_POD -n anchor -- npx prisma db seed
    
    log_info "Database seeded"
}

# Create test data
create_test_data() {
    log_info "Creating test data..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$API_POD" ]; then
        log_error "API pod not found"
        exit 1
    fi
    
    # Create test user
    kubectl exec -it $API_POD -n anchor -- node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function main() {
            // Create test user
            const user = await prisma.user.upsert({
                where: { email: 'test@example.com' },
                update: {},
                create: {
                    email: 'test@example.com',
                    passwordHash: '\$argon2id\$v=19\$m=65536,t=3,p=4\$test\$test',
                    name: 'Test User',
                },
            });
            
            console.log('Created test user:', user.id);
            
            // Create test memories
            const memories = [
                {
                    userId: user.id,
                    content: 'Meeting with John at 3pm tomorrow about the project',
                    type: 'MESSAGE',
                    source: 'WHATSAPP',
                    tags: ['meeting', 'work'],
                },
                {
                    userId: user.id,
                    content: 'Buy groceries: milk, eggs, bread, butter',
                    type: 'NOTE',
                    source: 'NATIVE_APP',
                    tags: ['shopping', 'personal'],
                },
                {
                    userId: user.id,
                    content: 'Call dentist to schedule appointment',
                    type: 'TASK',
                    source: 'VOICE',
                    tags: ['health', 'appointment'],
                },
            ];
            
            for (const memory of memories) {
                await prisma.memory.create({ data: memory });
            }
            
            console.log('Created test memories');
            
            // Create test tasks
            const tasks = [
                {
                    userId: user.id,
                    title: 'Buy groceries',
                    description: 'Milk, eggs, bread, butter',
                    priority: 'MEDIUM',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
                {
                    userId: user.id,
                    title: 'Call dentist',
                    description: 'Schedule appointment for next week',
                    priority: 'HIGH',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            ];
            
            for (const task of tasks) {
                await prisma.task.create({ data: task });
            }
            
            console.log('Created test tasks');
        }
        
        main()
            .catch(console.error)
            .finally(() => prisma.\$disconnect());
    "
    
    log_info "Test data created"
}

# Main function
main() {
    log_info "Starting database seed for ${ENVIRONMENT}..."
    
    check_prerequisites
    seed_database
    
    if [ "$ENVIRONMENT" = "development" ]; then
        create_test_data
    fi
    
    log_info "✅ Database seed completed!"
}

# Run main function
main
