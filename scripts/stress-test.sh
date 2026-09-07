#!/bin/bash

# Anchor Stress Testing Script
# This script performs stress testing on the application

set -e

echo "💥 Anchor Stress Testing Script"

# Configuration
ENVIRONMENT=${1:-production}
API_ENDPOINT=${2:-"https://api.anchor.app"}
MAX_VIRTUAL_USERS=${3:-500}
STEP_SIZE=${4:-50}
STEP_DURATION=${5:-60}

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
    
    # Check for k6
    if ! command -v k6 &> /dev/null; then
        log_warn "k6 not found, installing..."
        # For Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            sudo gpg -k
            sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
            echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
            sudo apt-get update
            sudo apt-get install k6
        else
            log_error "Cannot install k6 automatically"
            exit 1
        fi
    fi
    
    log_info "Prerequisites check passed"
}

# Create stress test script
create_stress_script() {
    log_info "Creating stress test script..."
    
    cat > /tmp/k6-stress-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

// Stress test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 300 },  // Ramp up to 300 users
    { duration: '5m', target: 300 },  // Stay at 300 users
    { duration: '2m', target: 400 },  // Ramp up to 400 users
    { duration: '5m', target: 400 },  // Stay at 400 users
    { duration: '2m', target: 500 },  // Ramp up to 500 users
    { duration: '5m', target: 500 },  // Stay at 500 users
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1000ms
    http_req_failed: ['rate<0.05'], // Error rate should be below 5%
    errors: ['rate<0.05'],
  },
};

// Test scenarios
export default function () {
  // Test health endpoint
  const healthRes = http.get(`${__ENV.API_ENDPOINT}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(healthRes.status !== 200);
  requestDuration.add(healthRes.timings.duration);

  sleep(0.5);

  // Test memory endpoint
  const memoryRes = http.get(`${__ENV.API_ENDPOINT}/api/memory`);
  check(memoryRes, {
    'memory status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'memory response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(memoryRes.status !== 200 && memoryRes.status !== 401);
  requestDuration.add(memoryRes.timings.duration);

  sleep(0.5);

  // Test search endpoint
  const searchRes = http.get(`${__ENV.API_ENDPOINT}/api/memory/search?q=test`);
  check(searchRes, {
    'search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'search response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  errorRate.add(searchRes.status !== 200 && searchRes.status !== 401);
  requestDuration.add(searchRes.timings.duration);

  sleep(0.5);
}

// Setup function
export function setup() {
  console.log(`Starting stress test with max ${__ENV.MAX_VIRTUAL_USERS} virtual users`);
  console.log(`API Endpoint: ${__ENV.API_ENDPOINT}`);
  console.log(`Step size: ${__ENV.STEP_SIZE} users`);
  console.log(`Step duration: ${__ENV.STEP_DURATION} seconds`);
}

// Teardown function
export function teardown(data) {
  console.log('Stress test completed');
}
EOF

  log_info "Stress test script created"
}

# Run stress test
run_stress_test() {
  log_info "Running stress test..."
  
  export MAX_VIRTUAL_USERS=$MAX_VIRTUAL_USERS
  export STEP_SIZE=$STEP_SIZE
  export STEP_DURATION=$STEP_DURATION
  export API_ENDPOINT=$API_ENDPOINT
  
  k6 run /tmp/k6-stress-test.js
  
  log_info "Stress test completed"
}

# Monitor during stress test
monitor_during_test() {
  log_info "Monitoring during stress test..."
  
  # Monitor pod resources
  kubectl top pods -n anchor
  
  # Monitor node resources
  kubectl top nodes
  
  # Monitor network
  kubectl get pods -n anchor -o wide
  
  # Monitor logs
  kubectl logs deployment/anchor-api -n anchor --tail=100
  
  # Monitor database
  DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
  if [ -n "$DB_POD" ]; then
    kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE state = 'active'"
  fi
  
  # Monitor Redis
  REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
  if [ -n "$REDIS_POD" ]; then
    kubectl exec -it $REDIS_POD -n anchor -- redis-cli INFO memory
  fi
}

# Analyze results
analyze_results() {
  log_info "Analyzing stress test results..."
  
  # Check for errors in logs
  log_info "Checking for errors in logs..."
  kubectl logs deployment/anchor-api -n anchor | grep -i "error" | tail -20
  
  # Check for performance degradation
  log_info "Checking for performance degradation..."
  kubectl logs deployment/anchor-api -n anchor | grep -i "slow" | tail -10
  
  # Check for memory issues
  log_info "Checking for memory issues..."
  kubectl logs deployment/anchor-api -n anchor | grep -i "memory" | tail -10
  
  # Check for CPU issues
  log_info "Checking for CPU issues..."
  kubectl logs deployment/anchor-api -n anchor | grep -i "cpu" | tail -10
}

# Generate stress test report
generate_report() {
  log_header "Stress Test Report"
  
  echo "Environment: ${ENVIRONMENT}"
  echo "API Endpoint: ${API_ENDPOINT}"
  echo "Max Virtual Users: ${MAX_VIRTUAL_USERS}"
  echo "Step Size: ${STEP_SIZE} users"
  echo "Step Duration: ${STEP_DURATION} seconds"
  echo "Timestamp: $(date)"
  echo ""
  
  check_prerequisites
  create_stress_script
  run_stress_test
  monitor_during_test
  analyze_results
  
  log_info "✅ Stress test completed"
}

# Main function
main() {
  log_info "Starting stress tests for ${ENVIRONMENT}..."
  
  generate_report
}

# Run main function
main
