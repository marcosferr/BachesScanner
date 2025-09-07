#!/bin/bash

# Road Damage Detection Flask Server - Docker Deployment Script

echo "🚀 Road Damage Detection Flask Server - Docker Deployment"
echo "========================================================"

# Function to show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     - Build and start the server"
    echo "  stop      - Stop the server"
    echo "  restart   - Restart the server"
    echo "  logs      - Show server logs"
    echo "  status    - Show server status"
    echo "  clean     - Stop and remove containers and images"
    echo ""
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Start the server
start_server() {
    echo "🏗️  Building and starting the Flask server..."
    docker-compose up --build -d
    echo "✅ Server started successfully!"
    echo "🌐 Server is running at: http://localhost:5000"
    echo "📊 View logs with: $0 logs"
}

# Stop the server
stop_server() {
    echo "🛑 Stopping the Flask server..."
    docker-compose down
    echo "✅ Server stopped successfully!"
}

# Restart the server
restart_server() {
    echo "🔄 Restarting the Flask server..."
    docker-compose restart
    echo "✅ Server restarted successfully!"
}

# Show logs
show_logs() {
    echo "📋 Showing server logs..."
    docker-compose logs -f flask-server
}

# Show status
show_status() {
    echo "📊 Server Status:"
    docker-compose ps
}

# Clean up
clean_up() {
    echo "🧹 Cleaning up containers and images..."
    docker-compose down --rmi all --volumes --remove-orphans
    echo "✅ Cleanup completed!"
}

# Main script logic
case "${1:-start}" in
    "start")
        check_docker
        start_server
        ;;
    "stop")
        stop_server
        ;;
    "restart")
        restart_server
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "clean")
        clean_up
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
