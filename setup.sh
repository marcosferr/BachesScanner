#!/bin/bash

echo "==================================="
echo "Road Damage Detection System Setup"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python is installed
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_status "Python $PYTHON_VERSION found"
        return 0
    else
        print_error "Python 3 is not installed. Please install Python 3.8 or higher."
        return 1
    fi
}

# Check if Node.js is installed
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js $NODE_VERSION found"
        return 0
    else
        print_error "Node.js is not installed. Please install Node.js 16 or higher."
        return 1
    fi
}

# Check if Expo CLI is installed
check_expo() {
    if command -v expo &> /dev/null; then
        EXPO_VERSION=$(expo --version)
        print_status "Expo CLI $EXPO_VERSION found"
        return 0
    else
        print_warning "Expo CLI not found. Installing..."
        npm install -g expo-cli
        if [ $? -eq 0 ]; then
            print_status "Expo CLI installed successfully"
            return 0
        else
            print_error "Failed to install Expo CLI"
            return 1
        fi
    fi
}

# Setup Flask server
setup_flask_server() {
    print_status "Setting up Flask server..."
    
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
        print_status "Flask server setup completed successfully"
    else
        print_error "Failed to install Python dependencies"
        return 1
    fi
    
    cd ..
    return 0
}

# Setup mobile app
setup_mobile_app() {
    print_status "Setting up mobile app..."
    
    cd mobile-app
    
    # Install npm dependencies
    print_status "Installing npm dependencies..."
    npm install
    
    if [ $? -eq 0 ]; then
        print_status "Mobile app setup completed successfully"
    else
        print_error "Failed to install npm dependencies"
        return 1
    fi
    
    cd ..
    return 0
}

# Get local IP address
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

# Main setup function
main() {
    print_status "Starting setup process..."
    
    # Check prerequisites
    check_python || exit 1
    check_node || exit 1
    check_expo || exit 1
    
    # Setup components
    setup_flask_server || exit 1
    setup_mobile_app || exit 1
    
    # Get IP address for configuration
    LOCAL_IP=$(get_local_ip)
    
    echo ""
    echo "======================================"
    echo "Setup completed successfully!"
    echo "======================================"
    echo ""
    print_status "Next steps:"
    echo "1. Update the server URL in mobile-app/utils/ApiService.js"
    echo "   Replace 'YOUR_SERVER_IP' with: $LOCAL_IP"
    echo ""
    echo "2. Start the Flask server:"
    echo "   cd flask-server"
    echo "   source venv/bin/activate  # or venv\\Scripts\\activate on Windows"
    echo "   python app.py"
    echo ""
    echo "3. Start the mobile app (in a new terminal):"
    echo "   cd mobile-app"
    echo "   expo start"
    echo ""
    print_warning "Don't forget to update the API_BASE_URL in ApiService.js!"
    echo "Set it to: http://$LOCAL_IP:5000/api"
}

# Run main function
main
