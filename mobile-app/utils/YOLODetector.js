import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import "@tensorflow/tfjs-platform-react-native";

class YOLODetector {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;

    // YOLO class names for road damage detection
    this.classNames = [
      "Longitudinal Crack",
      "Transverse Crack",
      "Alligator Crack",
      "Potholes",
    ];

    this.inputSize = 640;
  }

  async loadModel(modelUrl) {
    try {
      console.log("Loading YOLO model...");

      // Initialize TensorFlow.js
      await tf.ready();

      // Load the TFLite model
      this.model = await tf.loadLayersModel(modelUrl);
      this.isModelLoaded = true;

      console.log("YOLO model loaded successfully");
      return true;
    } catch (error) {
      console.error("Error loading model:", error);
      this.isModelLoaded = false;
      return false;
    }
  }

  preprocessImage(imageUri, targetSize = 640) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";

      image.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          canvas.width = targetSize;
          canvas.height = targetSize;

          // Draw and resize image
          ctx.drawImage(image, 0, 0, targetSize, targetSize);

          // Get image data
          const imageData = ctx.getImageData(0, 0, targetSize, targetSize);

          // Convert to tensor and normalize
          const tensor = tf.browser
            .fromPixels(imageData)
            .expandDims(0)
            .div(255.0);

          resolve(tensor);
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = reject;
      image.src = imageUri;
    });
  }

  async detectDamages(imageUri, confidenceThreshold = 0.5) {
    if (!this.isModelLoaded) {
      throw new Error("Model not loaded. Please load the model first.");
    }

    try {
      // Preprocess image
      const inputTensor = await this.preprocessImage(imageUri, this.inputSize);

      // Run inference
      const predictions = await this.model.predict(inputTensor);

      // Process predictions
      const detections = await this.processDetections(
        predictions,
        confidenceThreshold
      );

      // Clean up tensors
      inputTensor.dispose();
      predictions.dispose();

      return detections;
    } catch (error) {
      console.error("Error during detection:", error);
      throw error;
    }
  }

  async processDetections(predictions, confidenceThreshold) {
    // This is a simplified version - you'll need to adjust based on your YOLO model output format
    const detections = [];

    try {
      // Get prediction data
      const predictionData = await predictions.data();
      const predictionArray = Array.from(predictionData);

      // Process YOLO output (assuming standard YOLO format)
      // This will need to be adjusted based on your specific model output
      const numDetections = predictionArray.length / 6; // assuming [x, y, w, h, conf, class]

      for (let i = 0; i < numDetections; i++) {
        const offset = i * 6;
        const x = predictionArray[offset];
        const y = predictionArray[offset + 1];
        const width = predictionArray[offset + 2];
        const height = predictionArray[offset + 3];
        const confidence = predictionArray[offset + 4];
        const classId = Math.round(predictionArray[offset + 5]);

        if (
          confidence >= confidenceThreshold &&
          classId < this.classNames.length
        ) {
          detections.push({
            class: this.classNames[classId],
            confidence: confidence,
            bbox: [
              x - width / 2, // x1
              y - height / 2, // y1
              x + width / 2, // x2
              y + height / 2, // y2
            ],
          });
        }
      }
    } catch (error) {
      console.error("Error processing detections:", error);
    }

    return detections;
  }

  // Non-maximum suppression to remove overlapping detections
  applyNMS(detections, iouThreshold = 0.5) {
    if (detections.length <= 1) return detections;

    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);

    const result = [];
    const suppressed = new Array(detections.length).fill(false);

    for (let i = 0; i < detections.length; i++) {
      if (suppressed[i]) continue;

      result.push(detections[i]);

      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed[j]) continue;

        const iou = this.calculateIOU(detections[i].bbox, detections[j].bbox);
        if (iou > iouThreshold) {
          suppressed[j] = true;
        }
      }
    }

    return result;
  }

  calculateIOU(box1, box2) {
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;

    // Calculate intersection
    const x1_inter = Math.max(x1_1, x1_2);
    const y1_inter = Math.max(y1_1, y1_2);
    const x2_inter = Math.min(x2_1, x2_2);
    const y2_inter = Math.min(y2_1, y2_2);

    if (x2_inter <= x1_inter || y2_inter <= y1_inter) {
      return 0;
    }

    const intersectionArea = (x2_inter - x1_inter) * (y2_inter - y1_inter);

    // Calculate union
    const area1 = (x2_1 - x1_1) * (y2_1 - y1_1);
    const area2 = (x2_2 - x1_2) * (y2_2 - y1_2);
    const unionArea = area1 + area2 - intersectionArea;

    return intersectionArea / unionArea;
  }
}

export default YOLODetector;
