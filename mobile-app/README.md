# Road Damage Detection Mobile App

A React Native application using Expo that streams camera frames to a Flask server for real-time road damage detection using YOLOv8.

## Features

- **Real-time Camera Detection**: Stream camera frames to server for live inference
- **Server-side YOLO Processing**: Utilizes the full PyTorch YOLO model on the server
- **Live Overlay Display**: Shows annotated detection results overlaid on camera view
- **GPS Location Tracking**: Automatically capture GPS coordinates with each detection
- **Damage Classification**: Detects 4 types of road damage:
  - Longitudinal Crack
  - Transverse Crack
  - Alligator Crack
  - Potholes
- **Optional Result Saving**: Choose when to save detection results to database
- **Detection History**: View past detections and statistics
- **Configurable Settings**: Adjust confidence threshold, server URL, and app behavior

## New Architecture

**Server-side Inference Approach**:

1. Mobile app captures camera frames
2. Frames are sent as base64 to Flask server
3. Server runs YOLO inference using PyTorch model
4. Server returns annotated image with detection results
5. App displays annotated results as overlay on camera
6. User can optionally save results to database

**Benefits**:

- No model conversion needed (uses original PyTorch model)
- Consistent inference quality
- Reduced mobile resource usage
- Centralized model management

## Setup Instructions

### 1. Flask Server Setup (Required First)

The mobile app requires the Flask server to be running for inference.

Navigate to the flask-server directory and follow setup instructions:

```bash
cd ../flask-server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 2. Mobile App Setup

Navigate to the mobile-app directory:

```bash
cd mobile-app
```

Install dependencies:

```bash
npm install
```

### 3. Configuration

Update the server URL in `utils/ApiService.js`:

```javascript
const API_BASE_URL = "http://YOUR_SERVER_IP:5000/api";
```

Replace `YOUR_SERVER_IP` with your actual server IP address.

### 4. Run the App

Start the Expo development server:

```bash
expo start
```

## App Usage

### Camera Screen (Main)

- **Real-time Mode**: Toggle to enable continuous inference every 2 seconds
- **Manual Detection**: Tap "Detect" button to run inference on current frame
- **Save Results**: Save detection results with GPS location to database
- **Server Status**: Visual indicator showing server connection status

### Detection Display

- Annotated images with bounding boxes overlay the camera view
- Detection results show damage type and confidence percentage
- Timestamp of last detection
- Count of detected damages

### Settings Screen

- Configure server URL
- Test server connection
- Adjust confidence threshold
- Toggle auto-upload and photo saving
- View app information

### History Screen

- View all saved detections
- Detection statistics and damage distribution
- Refresh to update from server

## API Integration

The app communicates with the Flask server using these endpoints:

### Real-time Inference

```javascript
POST /api/infer
{
  "image_base64": "...",
  "confidence_threshold": 0.5,
  "save_result": false
}
```

### Save Detection Result

```javascript
POST /api/detect
{
  "image_base64": "...",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "detected_damages": [...]
}
```

## Performance Considerations

- **Frame Rate**: Inference runs every 2 seconds in real-time mode to balance performance and responsiveness
- **Image Quality**: Camera captures at 70% quality to reduce data transfer
- **Network**: Requires stable internet connection for server communication
- **Battery**: Real-time mode may consume more battery due to continuous processing

## Troubleshooting

### Server Connection Issues

- Verify server is running and accessible
- Check server URL configuration
- Ensure both devices are on same network
- Test server health in Settings screen

### Camera Issues

- Grant camera permissions in device settings
- Restart app if camera doesn't initialize
- Check device compatibility with Expo Camera

### Performance Issues

- Reduce confidence threshold if detections are slow
- Disable real-time mode for manual detection only
- Check network speed and server performance

## Development Notes

### Key Components

- `CameraScreen.js`: Main camera interface with real-time inference
- `ApiService.js`: Server communication for inference and data
- `HistoryScreen.js`: Detection history display
- `SettingsScreen.js`: App configuration

### Real-time Implementation

- Uses `setInterval` to capture frames periodically
- Converts camera frames to base64 for server transmission
- Displays server-returned annotated images as overlay
- Manages inference state to prevent overlapping requests

### Future Enhancements

- WebSocket connection for faster real-time processing
- Local caching of inference results
- Offline mode with local model fallback
- Video recording with detection overlay

## License

This project is for educational and research purposes.
