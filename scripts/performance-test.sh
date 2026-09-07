#!/bin/bash

# Anchor Performance Testing Script
# This script performs performance tests on the application

set -e

echo "⚡ Anchor Performance Testing Script"

# Configuration
ENVIRONMENT=${1:-production}
API_ENDPOINT=${2:-"https://api.anchor.app"}
CONCURRENT_USERS=${3:-10}
DURATION=${4:-60}

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

log_header() {
    echo -e "\n========================================"
    echo -e " $1"
    echo -e "========================================"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check for Apache Bench
    if ! command -v ab &> /dev/null; then
        log_warn "Apache Bench not found, installing..."
        apt-get update && apt-get install -y apache2-utils
    fi
    
    # Check for curl
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Test API response time
test_api_response_time() {
    log_header "API Response Time Test"
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    curl -s -o /dev/null -w "Health endpoint: %{time_total}s\n" "${API_ENDPOINT}/health"
    
    # Test memory endpoint
    log_info "Testing memory endpoint..."
    curl -s -o /dev/null -w "Memory endpoint: %{time_total}s\n" "${API_ENDPOINT}/api/memory"
    
    # Test search endpoint
    log_info "Testing search endpoint..."
    curl -s -o /dev/null -w "Search endpoint: %{time_total}s\n" "${API_ENDPOINT}/api/memory/search?q=test"
}

# Test concurrent users
test_concurrent_users() {
    log_header "Concurrent Users Test"
    
    log_info "Testing with ${CONCURRENT_USERS} concurrent users..."
    
    # Use Apache Bench for concurrent testing
    ab -n $((CONCURRENT_USERS * 10)) -c $CONCURRENT_USERS "${API_ENDPOINT}/health"
}

# Test API endpoints under load
test_endpoints_under_load() {
    log_header "API Endpoints Under Load"
    
    # Test health endpoint
    log_info "Testing health endpoint under load..."
    ab -n 1000 -c 50 "${API_ENDPOINT}/health"
    
    # Test memory endpoint
    log_info "Testing memory endpoint under load..."
    ab -n 1000 -c 50 "${API_ENDPOINT}/api/memory"
}

# Test database performance
test_database_performance() {
    log_header "Database Performance Test"
    
    # Get database pod
    DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$DB_POD" ]; then
        log_info "Testing database query performance..."
        
        # Test simple query
        kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "
            EXPLAIN ANALYZE SELECT * FROM users LIMIT 10;
        "
        
        # Test complex query
        kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "
            EXPLAIN ANALYZE 
            SELECT m.*, u.name 
            FROM memories m 
            JOIN users u ON m.user_id = u.id 
            WHERE m.is_archived = false 
            ORDER BY m.created_at DESC 
            LIMIT 10;
        "
    else
        log_warn "Database pod not found"
    fi
}

# Test Redis performance
test_redis_performance() {
    log_header "Redis Performance Test"
    
    # Get Redis pod
    REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$REDIS_POD" ]; then
        log_info "Testing Redis performance..."
        
        # Test SET/GET operations
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli --threads 4 -c -n 0 SET testkey "testvalue"
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli --threads 4 -c -n 0 GET testkey
        
        # Test pipeline operations
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli --threads 4 -c -n 0 PIPELINE SET key1 value1 SET key2 value2 SET key3 value3
    else
        log_warn "Redis pod not found"
    fi
}

# Test memory usage
test_memory_usage() {
    log_header "Memory Usage Test"
    
    # Check pod memory usage
    log_info "Checking pod memory usage..."
    kubectl top pods -n anchor
    
    # Check node memory usage
    log_info "Checking node memory usage..."
    kubectl top nodes
    
    # Check for memory leaks
    log_info "Checking for memory leaks..."
    kubectl logs deployment/anchor-api -n anchor --tail=100 | grep -i "memory" || log_info "No memory issues found"
}

# Test CPU usage
test_cpu_usage() {
    log_header "CPU Usage Test"
    
    # Check pod CPU usage
    log_info "Checking pod CPU usage..."
    kubectl top pods -n anchor
    
    # Check node CPU usage
    log_info "Checking node CPU usage..."
    kubectl top nodes
}

# Test network latency
test_network_latency() {
    log_header "Network Latency Test"
    
    # Test API latency
    log_info "Testing API latency..."
    for i in {1..10}; do
        curl -s -o /dev/null -w "Request $i: %{time_total}s\n" "${API_ENDPOINT}/health"
    done
    
    # Test DNS resolution
    log_info "Testing DNS resolution..."
    nslookup api.anchor.app
}

# Test storage performance
test_storage_performance() {
    log_header "Storage Performance Test"
    
    # Test S3 upload/download
    log_info "Testing S3 performance..."
    
    # Create test file
    dd if=/dev/zero of=testfile bs=1M count=10
    
    # Upload to S3
    time aws s3 cp testfile s3://anchor-storage-production/test/ --region us-east-1
    
    # Download from S3
    time aws s3 cp s3://anchor-storage-production/test/testfile ./downloadedfile --region us-east-1
    
    # Cleanup
    rm -f testfile downloadedfile
}

# Generate performance report
generate_report() {
    log_header "Performance Test Report"
    
    echo "Environment: ${ENVIRONMENT}"
    echo "API Endpoint: ${API_ENDPOINT}"
    echo "Concurrent Users: ${CONCURRENT_USERS}"
    echo "Duration: ${DURATION} seconds"
    echo "Timestamp: $(date)"
    echo ""
    
    check_prerequisites
    test_api_response_time
    test_concurrent_users
    test_endpoints_under_load
    test_database_performance
    test_redis_performance
    test_memory_usage
    test_cpu_usage
    test_network_latency
    test_storage_performance
    
    log_info "✅ Performance test completed"
}

# Main function
main() {
    log_info "Starting performance tests for ${ENVIRONMENT}..."
    
    generate_report
}

# Run main function
main
