#!/usr/bin/env python3
"""
Demo script to test the Flask server with sample data.
This script simulates the mobile app sending detection results to the server.
"""

import requests
import json
import base64
import random
import time
from pathlib import Path

# Server configuration
SERVER_URL = "http://localhost:5000"
API_BASE = f"{SERVER_URL}/api"

# Sample damage classes
DAMAGE_CLASSES = [
    "Longitudinal Crack",
    "Transverse Crack",
    "Alligator Crack",
    "Potholes",
]


def create_sample_image_base64():
    """Create a small sample image as base64 string"""
    # Create a simple 100x100 RGB image
    import numpy as np
    from PIL import Image
    import io

    # Create random image data
    image_data = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    image = Image.fromarray(image_data)

    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return f"data:image/jpeg;base64,{image_base64}"


def generate_sample_detection():
    """Generate a sample detection result"""

    # Random GPS coordinates (New York area)
    latitude = 40.7128 + random.uniform(-0.01, 0.01)
    longitude = -74.0060 + random.uniform(-0.01, 0.01)

    # Random number of damages (0-3)
    num_damages = random.randint(0, 3)
    detected_damages = []

    for _ in range(num_damages):
        damage = {
            "class": random.choice(DAMAGE_CLASSES),
            "confidence": round(random.uniform(0.5, 0.95), 2),
            "bbox": [
                random.randint(0, 50),  # x1
                random.randint(0, 50),  # y1
                random.randint(50, 100),  # x2
                random.randint(50, 100),  # y2
            ],
        }
        detected_damages.append(damage)

    return {
        "image_base64": create_sample_image_base64(),
        "latitude": latitude,
        "longitude": longitude,
        "detected_damages": detected_damages,
    }


def test_server_health():
    """Test if the server is running"""
    try:
        response = requests.get(SERVER_URL, timeout=5)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Server is running: {result['message']}")
            return True
        else:
            print(f"✗ Server responded with status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Cannot connect to server: {e}")
        return False


def send_detection(detection_data):
    """Send detection data to the server"""
    try:
        response = requests.post(
            f"{API_BASE}/detect",
            json=detection_data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✓ Detection sent successfully: ID {result['detection_id']}")
            return result
        else:
            error_result = (
                response.json()
                if response.headers.get("content-type") == "application/json"
                else {}
            )
            print(
                f"✗ Failed to send detection: {response.status_code} - {error_result.get('message', 'Unknown error')}"
            )
            return None
    except requests.exceptions.RequestException as e:
        print(f"✗ Error sending detection: {e}")
        return None


def get_detections():
    """Get all detections from the server"""
    try:
        response = requests.get(f"{API_BASE}/detections", timeout=5)
        if response.status_code == 200:
            result = response.json()
            detections = result["detections"]
            print(f"✓ Retrieved {len(detections)} detections")
            return detections
        else:
            print(f"✗ Failed to get detections: {response.status_code}")
            return []
    except requests.exceptions.RequestException as e:
        print(f"✗ Error getting detections: {e}")
        return []


def test_inference_endpoint():
    """Test the new inference endpoint"""
    try:
        print("Testing inference endpoint...")

        # Create a test image
        test_image_base64 = create_sample_image_base64()

        # Test inference without saving
        inference_data = {
            "image_base64": test_image_base64,
            "confidence_threshold": 0.5,
            "save_result": False,
        }

        response = requests.post(
            f"{API_BASE}/infer",
            json=inference_data,
            headers={"Content-Type": "application/json"},
            timeout=30,  # Longer timeout for inference
        )

        if response.status_code == 200:
            result = response.json()
            print(
                f"✓ Inference successful: Found {result['detection_count']} detections"
            )

            # Print detection details
            for i, detection in enumerate(result["detections"]):
                print(
                    f"  Detection {i+1}: {detection['class']} ({detection['confidence']:.2f})"
                )

            return result
        else:
            error_result = (
                response.json()
                if response.headers.get("content-type") == "application/json"
                else {}
            )
            print(
                f"✗ Inference failed: {response.status_code} - {error_result.get('message', 'Unknown error')}"
            )
            return None
    except requests.exceptions.RequestException as e:
        print(f"✗ Error testing inference: {e}")
        return None


def test_inference_with_save():
    """Test inference endpoint with saving enabled"""
    try:
        print("Testing inference with save...")

        # Create a test image
        test_image_base64 = create_sample_image_base64()

        # Random GPS coordinates
        latitude = 40.7128 + random.uniform(-0.01, 0.01)
        longitude = -74.0060 + random.uniform(-0.01, 0.01)

        # Test inference with saving
        inference_data = {
            "image_base64": test_image_base64,
            "confidence_threshold": 0.4,  # Lower threshold to increase detection chance
            "save_result": True,
            "latitude": latitude,
            "longitude": longitude,
        }

        response = requests.post(
            f"{API_BASE}/infer",
            json=inference_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if response.status_code == 200:
            result = response.json()
            print(
                f"✓ Inference with save successful: Found {result['detection_count']} detections"
            )

            if result.get("saved"):
                print(f"  Saved to database with ID: {result.get('detection_id')}")

            return result
        else:
            error_result = (
                response.json()
                if response.headers.get("content-type") == "application/json"
                else {}
            )
            print(
                f"✗ Inference with save failed: {response.status_code} - {error_result.get('message', 'Unknown error')}"
            )
            return None
    except requests.exceptions.RequestException as e:
        print(f"✗ Error testing inference with save: {e}")
        return None


def get_stats():
    """Get detection statistics"""
    try:
        response = requests.get(f"{API_BASE}/stats", timeout=5)
        if response.status_code == 200:
            result = response.json()
            stats = result["stats"]
            print(f"✓ Statistics:")
            print(f"  Total detections: {stats['total_detections']}")
            print(f"  Damage distribution: {stats['damage_type_distribution']}")
            return stats
        else:
            print(f"✗ Failed to get stats: {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"✗ Error getting stats: {e}")
        return None


def main():
    """Main demo function"""
    print("Road Damage Detection Server Demo")
    print("=" * 40)

    # Test server health
    print("1. Testing server connection...")
    if not test_server_health():
        print("Please start the Flask server first:")
        print("  cd flask-server")
        print("  python app.py")
        return

    print()

    # Test inference endpoint
    print("2. Testing inference endpoint...")
    inference_result = test_inference_endpoint()
    if inference_result:
        print(f"   Inference test successful!")

    print()

    # Test inference with save
    print("3. Testing inference with save...")
    save_result = test_inference_with_save()
    if save_result:
        print(f"   Inference with save test successful!")

    print()

    # Send sample detections (legacy endpoint)
    print("4. Sending sample detections (legacy)...")
    num_samples = 2
    successful_sends = 0

    for i in range(num_samples):
        print(f"Sending detection {i+1}/{num_samples}...")
        detection_data = generate_sample_detection()

        print(
            f"  Location: {detection_data['latitude']:.6f}, {detection_data['longitude']:.6f}"
        )
        print(f"  Damages: {len(detection_data['detected_damages'])}")

        result = send_detection(detection_data)
        if result:
            successful_sends += 1

        # Small delay between requests
        time.sleep(1)

    print(f"Successfully sent {successful_sends}/{num_samples} detections")
    print()

    # Get detections
    print("5. Retrieving detections...")
    detections = get_detections()

    if detections:
        print("Recent detections:")
        for detection in detections[:3]:  # Show first 3
            print(
                f"  ID: {detection['id']}, Location: {detection['latitude']:.6f}, {detection['longitude']:.6f}"
            )
            print(f"      Damages: {len(detection['detected_damages'])}")

    print()

    # Get statistics
    print("6. Getting statistics...")
    get_stats()

    print()
    print("Demo completed!")
    print(f"You can view more details at: {SERVER_URL}")
    print("\nAPI Endpoints available:")
    print(f"  - GET  {SERVER_URL}/             (Health check)")
    print(f"  - POST {API_BASE}/infer          (Run inference)")
    print(f"  - POST {API_BASE}/detect         (Save detection)")
    print(f"  - GET  {API_BASE}/detections     (Get all detections)")
    print(f"  - GET  {API_BASE}/stats          (Get statistics)")


if __name__ == "__main__":
    main()
