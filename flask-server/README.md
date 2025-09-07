# Flask Server for Road Damage Detection

A Flask-based server that receives road damage detection results from the mobile app and stores them in a SQLite database.

## Features

- RESTful API for receiving detection results
- SQLite database for data persistence
- Base64 image storage and management
- Detection statistics and history
- CORS support for mobile app communication

## Installation

1. Install Python dependencies:

```bash
pip install -r requirements.txt
```

2. Run the server:

```bash
python app.py
```

The server will start on `http://0.0.0.0:5000`

## API Documentation

### Health Check

```
GET /
```

Returns server status and timestamp.

### Send Detection Result

```
POST /api/detect
```

**Request Body:**

```json
{
  "image_base64": "base64_encoded_image_string",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "detected_damages": [
    {
      "class": "Potholes",
      "confidence": 0.85,
      "bbox": [x1, y1, x2, y2]
    }
  ]
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Detection saved successfully",
  "detection_id": 1,
  "image_id": "uuid-string",
  "damages_count": 1
}
```

### Get All Detections

```
GET /api/detections
```

Returns all detection records with metadata.

### Get Detection by ID

```
GET /api/detections/<detection_id>
```

Returns a specific detection record.

### Get Statistics

```
GET /api/stats
```

Returns detection statistics including damage type distribution.

## Database Schema

The SQLite database contains a `detections` table with the following schema:

```sql
CREATE TABLE detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT UNIQUE NOT NULL,
    image_path TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    detected_damages TEXT NOT NULL,  -- JSON string
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    confidence_scores TEXT  -- JSON string
)
```

## File Structure

```
flask-server/
├── app.py                    # Main Flask application
├── requirements.txt          # Python dependencies
├── Dockerfile               # Docker image configuration
├── docker-compose.yml       # Docker Compose configuration
├── .dockerignore           # Docker ignore file
├── uploads/                # Directory for uploaded images
├── static/                 # Static files directory
├── templates/              # HTML templates directory
├── YOLOv8_Small_RDD.pt     # YOLO model file
├── road_damage_detection.db # SQLite database (created automatically)
├── server.log              # Server log file
└── README.md               # This file
```

## Configuration

The server can be configured by modifying the following variables in `app.py`:

- `DB_NAME`: SQLite database filename
- `UPLOAD_FOLDER`: Directory for storing uploaded images
- Host and port settings in the `app.run()` call

## Security Considerations

For production deployment, consider:

- Adding authentication and authorization
- Implementing rate limiting
- Using HTTPS/SSL
- Input validation and sanitization
- Database connection pooling
- Error logging and monitoring

## Deployment

### Docker Deployment

The easiest way to deploy this Flask server is using Docker and Docker Compose.

#### Prerequisites

- Docker installed on your system
- Docker Compose installed

#### Quick Start with Docker

1. **Using the deployment script (recommended):**

```bash
# Navigate to the flask-server directory
cd flask-server

# Make the script executable (if not already)
chmod +x run.sh

# Start the server
./run.sh start
```

The server will be available at `http://localhost:5000`

2. **Using Docker Compose directly:**

```bash
# Navigate to the flask-server directory
cd flask-server

# Build and start the container
docker-compose up --build
```

3. **Run in background:**

```bash
# Run in detached mode
docker-compose up -d --build
```

4. **Stop the container:**

```bash
docker-compose down
```

#### Available Commands

The `run.sh` script provides convenient commands:

```bash
./run.sh start     # Build and start the server
./run.sh stop      # Stop the server
./run.sh restart   # Restart the server
./run.sh logs      # Show server logs
./run.sh status    # Show server status
./run.sh clean     # Stop and remove containers and images
```

#### Docker Configuration

The Docker setup includes:

- **Dockerfile**: Multi-stage build with Python 3.11, installs system dependencies for OpenCV
- **docker-compose.yml**: Defines the service with volume mounts for persistent data
- **.dockerignore**: Excludes unnecessary files from the build context

#### Volume Mounts

The following directories are mounted to persist data between container restarts:

- `./uploads`: Uploaded images
- `./road_damage_detection.db`: SQLite database
- `./server.log`: Server logs

#### Production Deployment

For production deployment with Docker:

1. **Use environment variables for configuration:**

```yaml
# In docker-compose.yml, add environment section:
environment:
  - FLASK_ENV=production
  - DB_NAME=road_damage_detection.db
```

2. **Scale the service:**

```bash
docker-compose up -d --scale flask-server=3
```

3. **Use Docker Swarm or Kubernetes for orchestration**

### Traditional Deployment

For production deployment without Docker:

1. Use a production WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

2. Set up a reverse proxy with Nginx
3. Configure SSL certificates
4. Set up monitoring and logging
5. Configure database backups

## Development

To run in development mode with debug enabled:

```bash
python app.py
```

The server will automatically reload on code changes when `debug=True` is set.
