from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import sqlite3
import base64
import os
import uuid
from datetime import datetime
import json
import cv2
import numpy as np
import torch
import torch.serialization
from ultralytics import YOLO
import io
import traceback
from PIL import Image

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native requests

# Database configuration
DB_NAME = "road_damage_detection.db"
UPLOAD_FOLDER = "uploads"

# Create uploads folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# YOLO Model configuration
MODEL_PATH = "./YOLOv8_Small_RDD.pt"  # Path to the PyTorch model
model = None

# YOLO class names
CLASSES = ["Longitudinal Crack", "Transverse Crack", "Alligator Crack", "Potholes"]


def load_yolo_model():
    """Load the YOLO model for inference"""
    global model
    try:
        print(f"Attempting to load YOLO model from {MODEL_PATH}...")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Model file exists: {os.path.exists(MODEL_PATH)}")

        # Add safe globals for PyTorch 2.6 compatibility
        try:
            from ultralytics.nn.tasks import DetectionModel

            torch.serialization.add_safe_globals([DetectionModel])
            print("Added DetectionModel to PyTorch safe globals")
        except Exception as e:
            print(f"Could not add safe globals: {e}")

        if os.path.exists(MODEL_PATH):
            print(f"Loading YOLO model from {MODEL_PATH}...")

            # Try loading with different approaches for PyTorch 2.6 compatibility
            try:
                model = YOLO(MODEL_PATH)
                print("YOLO model loaded successfully!")
            except Exception as e:
                print(f"First attempt failed: {e}")
                print("Trying with weights_only=False workaround...")

                # Temporarily modify torch.load behavior
                original_load = torch.load

                def safe_load(*args, **kwargs):
                    kwargs["weights_only"] = False
                    return original_load(*args, **kwargs)

                torch.load = safe_load
                try:
                    model = YOLO(MODEL_PATH)
                    print("YOLO model loaded successfully with weights_only=False!")
                finally:
                    # Restore original torch.load
                    torch.load = original_load

            print(f"Model type: {type(model)}")
            return True
        else:
            print(f"Model file not found at {MODEL_PATH}")
            # Try absolute path
            abs_path = os.path.abspath(MODEL_PATH)
            print(f"Trying absolute path: {abs_path}")
            if os.path.exists(abs_path):
                print(f"Loading YOLO model from absolute path: {abs_path}")
                model = YOLO(abs_path)
                print("YOLO model loaded successfully with absolute path!")
                return True
            return False
    except Exception as e:
        print(f"Error loading YOLO model: {e}")
        import traceback

        traceback.print_exc()
        return False


def init_db():
    """Initialize the SQLite database with the required tables."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Create table for storing detection results
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id TEXT UNIQUE NOT NULL,
            image_path TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            detected_damages TEXT NOT NULL,  -- JSON string of detected damages
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            confidence_scores TEXT  -- JSON string of confidence scores
        )
    """
    )

    conn.commit()
    conn.close()


def save_base64_image(base64_string, image_id):
    """Save base64 image to disk and return the file path."""
    try:
        # Remove data URL prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]

        # Decode base64 string
        image_data = base64.b64decode(base64_string)

        # Create filename
        filename = f"{image_id}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        # Save image
        with open(filepath, "wb") as f:
            f.write(image_data)

        return filepath
    except Exception as e:
        print(f"Error saving image: {e}")
        return None


def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    try:
        print(
            f"Received base64 string length: {len(base64_string) if base64_string else 'None'}"
        )

        if not base64_string:
            print("Error: Empty base64 string received")
            return None

        # Remove data URL prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
            print(f"After removing prefix, length: {len(base64_string)}")

        # Validate base64 string
        if len(base64_string) < 100:  # Too short to be a real image
            print(f"Error: Base64 string too short: {len(base64_string)}")
            return None

        # Decode base64 string
        image_data = base64.b64decode(base64_string)
        print(f"Decoded image data length: {len(image_data)}")

        if len(image_data) < 1000:  # Too small to be a real image
            print(f"Error: Decoded image data too small: {len(image_data)}")
            return None

        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_data))
        print(f"PIL image size: {pil_image.size}, mode: {pil_image.mode}")

        # Ensure RGB mode
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
            print(f"Converted to RGB mode")

        # Convert PIL to OpenCV format
        image_array = np.array(pil_image)
        if image_array.size == 0:
            print("Error: Empty image array after PIL conversion")
            return None

        opencv_image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        print(f"OpenCV image shape: {opencv_image.shape}")

        return opencv_image
    except Exception as e:
        print(f"Error converting base64 to image: {e}")
        import traceback

        traceback.print_exc()
        return None


def image_to_base64(image):
    """Convert OpenCV image to base64 string"""
    try:
        print(
            f"image_to_base64: Received image with shape: {image.shape if image is not None else 'None'}"
        )
        print(f"image_to_base64: Image type: {type(image)}")

        if image is None:
            print("Error: Received None image")
            return None

        if image.size == 0:
            print("Error: Received empty image")
            return None

        # Resize large images to reduce response size
        h, w = image.shape[:2]
        max_size = 800  # Maximum dimension
        if max(h, w) > max_size:
            if h > w:
                new_h = max_size
                new_w = int(w * max_size / h)
            else:
                new_w = max_size
                new_h = int(h * max_size / w)
            image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
            print(f"image_to_base64: Resized image to: {image.shape}")

        # Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        print(f"image_to_base64: Converted to RGB, shape: {rgb_image.shape}")

        # Convert to PIL Image
        pil_image = Image.fromarray(rgb_image)
        print(f"image_to_base64: PIL image created with size: {pil_image.size}")

        # Convert to base64 with lower quality to reduce size
        buffer = io.BytesIO()
        pil_image.save(buffer, format="JPEG", quality=60, optimize=True)
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        print(
            f"image_to_base64: Base64 conversion successful, length: {len(image_base64)}"
        )

        return f"data:image/jpeg;base64,{image_base64}"
    except Exception as e:
        print(f"Error converting image to base64: {e}")
        import traceback

        traceback.print_exc()
        return None


def run_yolo_inference(image, confidence_threshold=0.5):
    """Run YOLO inference on an image"""
    global model

    if model is None:
        print("YOLO model is not loaded")
        return image, []

    try:
        print(f"run_yolo_inference: Input image shape: {image.shape}")

        # Resize image for inference
        h_ori, w_ori = image.shape[:2]
        image_resized = cv2.resize(image, (640, 640), interpolation=cv2.INTER_AREA)
        print(f"run_yolo_inference: Resized image shape: {image_resized.shape}")

        # Run inference
        results = model.predict(image_resized, conf=confidence_threshold, verbose=False)
        print(f"run_yolo_inference: YOLO prediction completed")

        # Process results
        detections = []
        annotated_image = image.copy()
        print(
            f"run_yolo_inference: Created annotated_image copy with shape: {annotated_image.shape}"
        )

        for result in results:
            boxes = result.boxes
            if boxes is not None:
                print(f"run_yolo_inference: Found {len(boxes)} detections")
                for box in boxes:
                    # Get box coordinates and scale back to original image size
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                    # Scale coordinates back to original image size
                    x1 = int(x1 * w_ori / 640)
                    y1 = int(y1 * h_ori / 640)
                    x2 = int(x2 * w_ori / 640)
                    y2 = int(y2 * h_ori / 640)

                    # Get class and confidence
                    cls_id = int(box.cls[0].cpu().numpy())
                    confidence = float(box.conf[0].cpu().numpy())
                    class_name = (
                        CLASSES[cls_id] if cls_id < len(CLASSES) else f"Class_{cls_id}"
                    )

                    # Add detection
                    detections.append(
                        {
                            "class": class_name,
                            "confidence": confidence,
                            "bbox": [x1, y1, x2, y2],
                        }
                    )

                    # Draw bounding box on image
                    color = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0)][
                        cls_id % 4
                    ]
                    cv2.rectangle(annotated_image, (x1, y1), (x2, y2), color, 2)

                    # Draw label
                    label = f"{class_name}: {confidence:.2f}"
                    label_size = cv2.getTextSize(
                        label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
                    )[0]
                    cv2.rectangle(
                        annotated_image,
                        (x1, y1 - label_size[1] - 10),
                        (x1 + label_size[0], y1),
                        color,
                        -1,
                    )
                    cv2.putText(
                        annotated_image,
                        label,
                        (x1, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 255, 255),
                        2,
                    )
            else:
                print("run_yolo_inference: No boxes found in this result")

        print(
            f"run_yolo_inference: Final annotated_image shape: {annotated_image.shape}"
        )
        print(f"run_yolo_inference: Total detections: {len(detections)}")
        return annotated_image, detections

    except Exception as e:
        print(f"Error during YOLO inference: {e}")
        import traceback

        traceback.print_exc()
        return image, []


@app.route("/")
def home():
    """Health check endpoint."""
    return jsonify(
        {
            "status": "success",
            "message": "Road Damage Detection Flask Server is running",
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/dashboard")
def dashboard():
    """Web dashboard to view all detections."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Get all detections
        cursor.execute(
            """
            SELECT id, timestamp, latitude, longitude, image_path, detected_damages, confidence_scores
            FROM detections
            ORDER BY timestamp DESC
        """
        )

        rows = cursor.fetchall()

        detections = []
        damage_type_distribution = {}

        for row in rows:
            (
                detection_id,
                timestamp,
                latitude,
                longitude,
                image_path,
                detected_damages_json,
                confidence_scores_json,
            ) = row

            # Parse JSON data
            try:
                detected_damages = (
                    json.loads(detected_damages_json) if detected_damages_json else []
                )
                confidence_scores = (
                    json.loads(confidence_scores_json) if confidence_scores_json else []
                )
            except:
                detected_damages = []
                confidence_scores = []

            # Don't read image as base64 here - we'll use the API endpoint
            image_url = f"/api/image/{detection_id}"

            # Process damages for display
            damage_list = []
            damage_types = []

            for damage_obj in detected_damages:
                if isinstance(damage_obj, dict):
                    # New format: dict with class, confidence, bbox
                    damage_class = damage_obj.get("class", "Unknown")
                    confidence = damage_obj.get("confidence", 0.5)
                else:
                    # Legacy format: just the class name as string
                    damage_class = damage_obj
                    confidence = 0.5

                damage_list.append({"class": damage_class, "confidence": confidence})
                if damage_class not in damage_types:
                    damage_types.append(damage_class)

                # Update distribution
                damage_type_distribution[damage_class] = (
                    damage_type_distribution.get(damage_class, 0) + 1
                )

            detections.append(
                {
                    "id": detection_id,
                    "timestamp": datetime.fromisoformat(timestamp).strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
                    "date": datetime.fromisoformat(timestamp).strftime("%Y-%m-%d"),
                    "latitude": latitude,
                    "longitude": longitude,
                    "image_url": image_url,
                    "detected_damages": damage_list,
                    "damage_types": damage_types,
                }
            )

        # Get statistics
        total_detections = len(detections)

        stats = {
            "total_detections": total_detections,
            "damage_type_distribution": damage_type_distribution,
        }

        conn.close()

        return render_template("detections.html", detections=detections, stats=stats)

    except Exception as e:
        print(f"Error in dashboard: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/image/<int:detection_id>")
def get_detection_image(detection_id):
    """Serve detection image by ID."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT image_path FROM detections WHERE id = ?", (detection_id,)
        )
        result = cursor.fetchone()
        conn.close()

        if result and result[0]:
            image_path = result[0]

            # Check if file exists
            if os.path.exists(image_path):
                from flask import send_file

                return send_file(
                    image_path,
                    mimetype="image/jpeg",
                    as_attachment=False,
                    download_name=f"detection_{detection_id}.jpg",
                )
            else:
                return jsonify({"error": "Image file not found"}), 404
        else:
            return jsonify({"error": "Detection not found"}), 404

    except Exception as e:
        print(f"Error serving image: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/detect", methods=["POST"])
def detect_damage():
    """
    Endpoint to receive detection results from the mobile app.

    Expected JSON payload:
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
    """
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ["image_base64", "latitude", "longitude", "detected_damages"]
        for field in required_fields:
            if field not in data:
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": f"Missing required field: {field}",
                        }
                    ),
                    400,
                )

        # Generate unique image ID
        image_id = str(uuid.uuid4())

        # Save base64 image to disk
        image_path = save_base64_image(data["image_base64"], image_id)
        if not image_path:
            return jsonify({"status": "error", "message": "Failed to save image"}), 500

        # Extract damage information
        detected_damages = data["detected_damages"]
        confidence_scores = [
            damage.get("confidence", 0.0) for damage in detected_damages
        ]

        # Save to database
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO detections 
            (image_id, image_path, latitude, longitude, detected_damages, confidence_scores)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                image_id,
                image_path,
                float(data["latitude"]),
                float(data["longitude"]),
                json.dumps(detected_damages),
                json.dumps(confidence_scores),
            ),
        )

        conn.commit()
        detection_id = cursor.lastrowid
        conn.close()

        return (
            jsonify(
                {
                    "status": "success",
                    "message": "Detection saved successfully",
                    "detection_id": detection_id,
                    "image_id": image_id,
                    "damages_count": len(detected_damages),
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error processing detection: {e}")
        return (
            jsonify(
                {"status": "error", "message": "Internal server error", "error": str(e)}
            ),
            500,
        )


@app.route("/api/infer", methods=["POST"])
def infer_damage():
    """
    Endpoint to run YOLO inference on an image.

    Expected JSON payload:
    {
        "image_base64": "base64_encoded_image_string",
        "confidence_threshold": 0.5,
        "save_result": false,
        "latitude": 40.7128,  // optional, only if save_result is true
        "longitude": -74.0060  // optional, only if save_result is true
    }

    Returns:
    {
        "status": "success",
        "annotated_image_base64": "base64_encoded_annotated_image",
        "detections": [
            {
                "class": "Potholes",
                "confidence": 0.85,
                "bbox": [x1, y1, x2, y2]
            }
        ],
        "detection_count": 1
    }
    """
    try:
        data = request.get_json()

        # Validate required fields
        if "image_base64" not in data:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Missing required field: image_base64",
                    }
                ),
                400,
            )

        # Get parameters
        confidence_threshold = data.get("confidence_threshold", 0.5)
        save_result = data.get("save_result", False)

        # Convert base64 to image
        image = base64_to_image(data["image_base64"])
        if image is None:
            return (
                jsonify({"status": "error", "message": "Failed to decode image"}),
                400,
            )

        # Run YOLO inference
        annotated_image, detections = run_yolo_inference(image, confidence_threshold)
        print(
            f"infer_damage: Received annotated_image with shape: {annotated_image.shape if annotated_image is not None else 'None'}"
        )

        # Convert annotated image back to base64
        annotated_image_base64 = image_to_base64(annotated_image)
        if annotated_image_base64 is None:
            return (
                jsonify(
                    {"status": "error", "message": "Failed to encode annotated image"}
                ),
                500,
            )

        result = {
            "status": "success",
            "annotated_image_base64": annotated_image_base64,
            "detections": detections,
            "detection_count": len(detections),
        }

        # Optionally save result to database
        if save_result and detections:
            latitude = data.get("latitude")
            longitude = data.get("longitude")

            if latitude is not None and longitude is not None:
                # Generate unique image ID
                image_id = str(uuid.uuid4())

                # Save original image
                image_path = save_base64_image(data["image_base64"], image_id)

                if image_path:
                    # Save to database
                    conn = sqlite3.connect(DB_NAME)
                    cursor = conn.cursor()

                    confidence_scores = [det["confidence"] for det in detections]

                    cursor.execute(
                        """
                        INSERT INTO detections 
                        (image_id, image_path, latitude, longitude, detected_damages, confidence_scores)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """,
                        (
                            image_id,
                            image_path,
                            float(latitude),
                            float(longitude),
                            json.dumps(detections),
                            json.dumps(confidence_scores),
                        ),
                    )

                    conn.commit()
                    detection_id = cursor.lastrowid
                    conn.close()

                    result["saved"] = True
                    result["detection_id"] = detection_id
                    result["image_id"] = image_id

        return jsonify(result), 200

    except Exception as e:
        print(f"Error during inference: {e}")
        return (
            jsonify(
                {"status": "error", "message": "Inference failed", "error": str(e)}
            ),
            500,
        )


@app.route("/api/detections", methods=["GET"])
def get_detections():
    """Get all detection records."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, image_id, latitude, longitude, detected_damages, 
                   confidence_scores, timestamp
            FROM detections
            ORDER BY timestamp DESC
        """
        )

        detections = []
        for row in cursor.fetchall():
            detections.append(
                {
                    "id": row[0],
                    "image_id": row[1],
                    "latitude": row[2],
                    "longitude": row[3],
                    "detected_damages": json.loads(row[4]),
                    "confidence_scores": json.loads(row[5]),
                    "timestamp": row[6],
                }
            )

        conn.close()

        return (
            jsonify(
                {
                    "status": "success",
                    "detections": detections,
                    "count": len(detections),
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error fetching detections: {e}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Failed to fetch detections",
                    "error": str(e),
                }
            ),
            500,
        )


@app.route("/api/detections/<detection_id>", methods=["GET"])
def get_detection(detection_id):
    """Get a specific detection by ID."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, image_id, image_path, latitude, longitude, detected_damages, 
                   confidence_scores, timestamp
            FROM detections
            WHERE id = ?
        """,
            (detection_id,),
        )

        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"status": "error", "message": "Detection not found"}), 404

        detection = {
            "id": row[0],
            "image_id": row[1],
            "image_path": row[2],
            "latitude": row[3],
            "longitude": row[4],
            "detected_damages": json.loads(row[5]),
            "confidence_scores": json.loads(row[6]),
            "timestamp": row[7],
        }

        return jsonify({"status": "success", "detection": detection}), 200

    except Exception as e:
        print(f"Error fetching detection: {e}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Failed to fetch detection",
                    "error": str(e),
                }
            ),
            500,
        )


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get detection statistics."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Total detections
        cursor.execute("SELECT COUNT(*) FROM detections")
        total_detections = cursor.fetchone()[0]

        # Damage type distribution
        cursor.execute("SELECT detected_damages FROM detections")
        damage_types = {}

        for row in cursor.fetchall():
            damages = json.loads(row[0])
            for damage in damages:
                damage_class = damage.get("class", "Unknown")
                damage_types[damage_class] = damage_types.get(damage_class, 0) + 1

        conn.close()

        return (
            jsonify(
                {
                    "status": "success",
                    "stats": {
                        "total_detections": total_detections,
                        "damage_type_distribution": damage_types,
                    },
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error fetching stats: {e}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Failed to fetch statistics",
                    "error": str(e),
                }
            ),
            500,
        )


if __name__ == "__main__":
    # Initialize database
    init_db()
    print("Database initialized successfully")

    # Load YOLO model
    if load_yolo_model():
        print("YOLO model loaded successfully")
    else:
        print("Warning: YOLO model failed to load. Inference will not work.")

    # Run the Flask app
    app.run(host="0.0.0.0", port=5000, debug=True)
