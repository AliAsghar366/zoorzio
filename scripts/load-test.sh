#!/bin/bash

# Anchor Load Testing Script
# This script performs load testing on the application

set -e

echo "🏋️ Anchor Load Testing Script"

# Configuration
ENVIRONMENT=${1:-production}
API_ENDPOINT=${2:-"https://api.anchor.app"}
VIRTUAL_USERS=${3:-100}
DURATION=${4:-300}
RAMP_UP=${5:-60}

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

# Create k6 test script
create_k6_script() {
    log_info "Creating k6 test script..."
    
    cat > /tmp/k6-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: __ENV.VIRTUAL_USERS }, // Ramp up
    { duration: `${__ENV.DURATION}s`, target: __ENV.VIRTUAL_USERS }, // Stay at peak
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'], // Error rate should be below 1%
    errors: ['rate<0.01'],
  },
};

// Test scenarios
export default function () {
  // Test health endpoint
  const healthRes = http.get(`${__ENV.API_ENDPOINT}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(healthRes.status !== 200);
  requestDuration.add(healthRes.timings.duration);

  sleep(1);

  // Test memory endpoint
  const memoryRes = http.get(`${__ENV.API_ENDPOINT}/api/memory`);
  check(memoryRes, {
    'memory status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'memory response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(memoryRes.status !== 200 && memoryRes.status !== 401);
  requestDuration.add(memoryRes.timings.duration);

  sleep(1);

  // Test search endpoint
  const searchRes = http.get(`${__ENV.API_ENDPOINT}/api/memory/search?q=test`);
  check(searchRes, {
    'search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'search response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(searchRes.status !== 200 && searchRes.status !== 401);
  requestDuration.add(searchRes.timings.duration);

  sleep(1);
}

// Setup function
export function setup() {
  console.log(`Starting load test with ${__ENV.VIRTUAL_USERS} virtual users`);
  console.log(`API Endpoint: ${__ENV.API_ENDPOINT}`);
  console.log(`Duration: ${__ENV.DURATION} seconds`);
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed');
}
EOF

  log_info "k6 test script created"
}

# Run k6 load test
run_k6_test() {
  log_info "Running k6 load test..."
  
  export VIRTUAL_USERS=$VIRTUAL_USERS
  export DURATION=$DURATION
  export API_ENDPOINT=$API_ENDPOINT
  
  k6 run /tmp/k6-test.js
  
  log_info "k6 load test completed"
}

# Run Apache Bench load test
run_ab_test() {
  log_info "Running Apache Bench load test..."
  
  # Test health endpoint
  log_info "Testing health endpoint..."
  ab -n 10000 -c 100 "${API_ENDPOINT}/health"
  
  # Test memory endpoint
  log_info "Testing memory endpoint..."
  ab -n 10000 -c 100 "${API_ENDPOINT}/api/memory"
  
  log_info "Apache Bench load test completed"
}

# Run curl load test
run_curl_test() {
  log_info "Running curl load test..."
  
  # Test with multiple concurrent requests
  for i in {1..100}; do
    curl -s -o /dev/null -w "Request $i: %{time_total}s\n" "${API_ENDPOINT}/health" &
  done
  
  # Wait for all background jobs to finish
  wait
  
  log_info "curl load test completed"
}

# Monitor during load test
monitor_during_test() {
  log_info "Monitoring during load test..."
  
  # Monitor pod resources
  kubectl top pods -n anchor
  
  # Monitor node resources
  kubectl top nodes
  
  # Monitor network
  kubectl get pods -n anchor -o wide
  
  # Monitor logs
  kubectl logs deployment/anchor-api -n anchor --tail=50
}

# Generate load test report
generate_report() {
  log_header "Load Test Report"
  
  echo "Environment: ${ENVIRONMENT}"
  echo "API Endpoint: ${API_ENDPOINT}"
  echo "Virtual Users: ${VIRTUAL_USERS}"
  echo "Duration: ${DURATION} seconds"
  echo "Ramp-up: ${RAMP_UP} seconds"
  echo "Timestamp: $(date)"
  echo ""
  
  check_prerequisites
  create_k6_script
  run_k6_test
  run_ab_test
  run_curl_test
  monitor_during_test
  
  log_info "✅ Load test completed"
}

# Main function
main() {
  log_info "Starting load tests for ${ENVIRONMENT}..."
  
  generate_report
}

# Run main function
main
