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
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── uploads/           # Directory for uploaded images
└── road_damage_detection.db # SQLite database (created automatically)
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

For production deployment:

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
