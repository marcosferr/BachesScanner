#!/bin/bash

echo "==============================================="
echo "Road Damage Detection Server Setup & Test"
echo "==============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if required files exist
check_files() {
    print_step "Checking required files..."
    
    if [ ! -f "YOLOv8_Small_RDD.pt" ]; then
        print_error "YOLOv8_Small_RDD.pt not found in current directory"
        return 1
    fi
    
    if [ ! -f "flask-server/app.py" ]; then
        print_error "Flask server not found at flask-server/app.py"
        return 1
    fi
    
    print_status "All required files found"
    return 0
}

# Setup Flask server
setup_server() {
    print_step "Setting up Flask server..."
    
    cd flask-server
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    print_status "Activating virtual environment..."
    source venv/bin/activate
    
    # Install requirements
    print_status "Installing Python dependencies..."
    pip install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        print_status "Server dependencies installed successfully"
    else
        print_error "Failed to install server dependencies"
        return 1
    fi
    
    cd ..
    return 0
}

# Start server in background
start_server() {
    print_step "Starting Flask server..."
    
    cd flask-server
    source venv/bin/activate
    
    # Start server in background
    nohup python app.py > server.log 2>&1 &
    SERVER_PID=$!
    
    cd ..
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server is running
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_status "Flask server started successfully (PID: $SERVER_PID)"
        echo $SERVER_PID > server.pid
        return 0
    else
        print_error "Failed to start Flask server"
        return 1
    fi
}

# Test server
test_server() {
    print_step "Testing server endpoints..."
    
    # Wait for server to be ready
    print_status "Waiting for server to initialize..."
    sleep 5
    
    # Run test script
    print_status "Running comprehensive server tests..."
    python test_server.py
    
    if [ $? -eq 0 ]; then
        print_status "Server tests completed"
    else
        print_warning "Some server tests may have failed"
    fi
}

# Stop server
stop_server() {
    print_step "Stopping Flask server..."
    
    if [ -f "server.pid" ]; then
        SERVER_PID=$(cat server.pid)
        if kill -0 $SERVER_PID 2>/dev/null; then
            kill $SERVER_PID
            print_status "Flask server stopped (PID: $SERVER_PID)"
            rm server.pid
        else
            print_warning "Server process not found"
        fi
    else
        print_warning "No server PID file found"
    fi
}

# Get local IP
get_local_ip() {
    if command -v ip &> /dev/null; then
        LOCAL_IP=$(ip route get 8.8.8.8 | awk -F"src " 'NR==1{split($2,a," ");print a[1]}')
    elif command -v ifconfig &> /dev/null; then
        LOCAL_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
    else
        LOCAL_IP="localhost"
    fi
    echo $LOCAL_IP
}

# Main function
main() {
    print_status "Starting Road Damage Detection server setup and test..."
    
    # Check files
    check_files || exit 1
    
    # Setup server
    setup_server || exit 1
    
    # Start server
    start_server || exit 1
    
    # Test server
    test_server
    
    # Get IP address
    LOCAL_IP=$(get_local_ip)
    
    echo ""
    echo "================================================"
    echo "Setup and Testing Completed!"
    echo "================================================"
    echo ""
    print_status "Flask server is running at: http://$LOCAL_IP:5000"
    echo ""
    echo "API Endpoints:"
    echo "  Health check: GET  http://$LOCAL_IP:5000/"
    echo "  Inference:    POST http://$LOCAL_IP:5000/api/infer"
    echo "  Save result:  POST http://$LOCAL_IP:5000/api/detect"
    echo "  Get history:  GET  http://$LOCAL_IP:5000/api/detections"
    echo "  Get stats:    GET  http://$LOCAL_IP:5000/api/stats"
    echo ""
    print_status "For mobile app configuration:"
    echo "  Update API_BASE_URL in mobile-app/utils/ApiService.js"
    echo "  Set it to: http://$LOCAL_IP:5000/api"
    echo ""
    print_status "To stop the server:"
    echo "  Run: $0 stop"
    echo ""
    print_status "To view server logs:"
    echo "  Run: tail -f flask-server/server.log"
}

# Handle command line arguments
case "${1:-}" in
    "stop")
        stop_server
        ;;
    "start")
        start_server
        ;;
    "test")
        test_server
        ;;
    *)
        main
        ;;
esac
