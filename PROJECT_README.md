# Road Damage Detection System

A complete system for detecting road damage using YOLOv8 and mobile application integration. The system consists of:

1. **React Native Mobile App** - Captures photos and runs AI detection
2. **Flask Server** - Receives and stores detection results
3. **YOLOv8 Model** - Pre-trained for road damage detection

## System Overview

```
Mobile App (React Native + Expo)
    ↓ (Camera frames as base64)
Flask Server (Python + YOLO)
    ↓ (Inference results + annotated images)
Mobile App (Display results)
    ↓ (Optionally save to database)
Database (SQLite)
```

## Architecture Changes

**NEW APPROACH**: Server-side inference with real-time camera streaming

- Mobile app captures camera frames and sends them to the Flask server
- Flask server runs YOLO inference using the PyTorch model
- Server returns annotated images with detection results
- Mobile app displays the annotated results in real-time overlay
- Users can choose to save detection results to the database

**Benefits**:

- No need to convert TensorFlow Lite models for mobile
- Consistent inference quality using the original PyTorch model
- Reduced mobile app complexity and resource usage
- Centralized model management and updates

## Components

### 1. Mobile Application (`mobile-app/`)

- **Technology**: React Native with Expo
- **Features**:
  - Camera integration for photo capture
  - GPS location tracking
  - YOLOv8 TensorFlow Lite model integration
  - Real-time damage detection
  - Detection history and statistics
  - Configurable settings

### 2. Flask Server (`flask-server/`)

- **Technology**: Python Flask with SQLite
- **Features**:
  - RESTful API for mobile app communication
  - Base64 image processing and storage
  - SQLite database for data persistence
  - Detection statistics and reporting
  - CORS support for cross-origin requests

### 3. AI Models

- **YOLOv8 Small Road Damage Detection Model**
- **Formats**: PyTorch (.pt), ONNX (.onnx), TensorFlow Lite (.tflite)
- **Classes**: 4 road damage types
  - Longitudinal Crack
  - Transverse Crack
  - Alligator Crack
  - Potholes

## Quick Start

### Prerequisites

- Node.js (v16+)
- Python 3.8+
- Expo CLI
- Android Studio or iOS development tools

### 1. Setup Flask Server

```bash
cd flask-server
pip install -r requirements.txt
python app.py
```

### 2. Setup Mobile App

```bash
cd mobile-app
npm install
expo start
```

### 3. Configure Connection

Update the server URL in `mobile-app/utils/ApiService.js`:

```javascript
const API_BASE_URL = "http://YOUR_SERVER_IP:5000/api";
```

## Architecture

### Data Flow

1. User opens camera screen in mobile app
2. App captures video frames and converts them to base64
3. Frames are sent to Flask server's `/api/infer` endpoint
4. Server runs YOLO inference on the PyTorch model
5. Server returns annotated image with bounding boxes and detection results
6. App displays the annotated image as an overlay on the camera view
7. User can optionally save detection results to the database
8. Real-time mode continuously processes frames every 2 seconds

### Mobile App Architecture

```
App.js (Navigation)
├── CameraScreen.js (Real-time camera + server inference)
├── HistoryScreen.js (Detection history)
└── SettingsScreen.js (Configuration)

Utils/
└── ApiService.js (Server communication for inference)
```

### Server Architecture

```
app.py (Flask application)
├── /api/infer (POST - run YOLO inference on image)
├── /api/detect (POST - save detection results)
├── /api/detections (GET - fetch detection history)
├── /api/detections/<id> (GET - fetch specific detection)
└── /api/stats (GET - get detection statistics)

Model: YOLOv8_Small_RDD.pt (PyTorch model loaded with ultralytics)
Database: SQLite (road_damage_detection.db)
Storage: uploads/ (Base64 decoded images)
```

## API Specification

### Run Inference (NEW)

```http
POST /api/infer
Content-Type: application/json

{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "confidence_threshold": 0.5,
  "save_result": false,
  "latitude": 40.7128,    // optional, only if save_result is true
  "longitude": -74.0060   // optional, only if save_result is true
}
```

**Response:**

```json
{
  "status": "success",
  "annotated_image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "detections": [
    {
      "class": "Potholes",
      "confidence": 0.85,
      "bbox": [100, 200, 300, 400]
    }
  ],
  "detection_count": 1,
  "saved": false
}
```

### Send Detection Result (Legacy)

```http
POST /api/detect
Content-Type: application/json

{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "detected_damages": [
    {
      "class": "Potholes",
      "confidence": 0.85,
      "bbox": [100, 200, 300, 400]
    }
  ]
}
```

### Response

```json
{
  "status": "success",
  "detection_id": 123,
  "image_id": "uuid-string",
  "damages_count": 1
}
```

## Development Setup

### Environment Setup

1. **Python Environment**:

   ```bash
   cd flask-server
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Node.js Environment**:
   ```bash
   cd mobile-app
   npm install
   ```

### Model Conversion

The project includes conversion utilities in `export.py` to convert between formats:

- PyTorch (.pt) → ONNX (.onnx)
- ONNX → TensorFlow (.pb)
- TensorFlow → TensorFlow Lite (.tflite)

## Deployment

### Mobile App Deployment

1. **Android**: Build APK using `expo build:android`
2. **iOS**: Build IPA using `expo build:ios`
3. **Web**: Deploy using `expo build:web`

### Server Deployment

1. Use production WSGI server (Gunicorn)
2. Configure reverse proxy (Nginx)
3. Set up SSL certificates
4. Configure database backups
5. Set up monitoring and logging

## Project Structure

```
BachesScanner/
├── mobile-app/                    # React Native Expo app
│   ├── components/               # UI components
│   ├── utils/                   # Utility functions
│   ├── assets/                  # Static assets and models
│   └── package.json            # Dependencies
├── flask-server/                # Python Flask server
│   ├── app.py                  # Main server application
│   ├── requirements.txt        # Python dependencies
│   └── uploads/               # Image storage
├── converted_models/           # AI model files
│   ├── YOLOv8_Small_RDD.tflite
│   └── YOLOv8_Small_RDD_tf/
├── export.py                  # Model conversion utility
├── YOLOv8_Small_RDD.pt       # Original PyTorch model
└── requirements.txt          # Python dependencies for model conversion
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for educational and research purposes.

## Support

For issues and questions:

1. Check the README files in each component directory
2. Review the troubleshooting sections
3. Create an issue on the repository
