"""
TensorFlow Lite to TensorFlow.js Model Converter for React Native

This script converts a TensorFlow Lite model to TensorFlow.js format
that can be used in React Native applications.
"""

import tensorflow as tf
import tensorflowjs as tfjs
import numpy as np
import os
import shutil
from pathlib import Path


def tflite_to_tfjs(tflite_path, output_dir):
    """
    Convert TensorFlow Lite model to TensorFlow.js format.

    Args:
        tflite_path (str): Path to the .tflite model file
        output_dir (str): Directory to save the converted model
    """

    print(f"Converting {tflite_path} to TensorFlow.js format...")

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Load the TFLite model
        interpreter = tf.lite.Interpreter(model_path=tflite_path)
        interpreter.allocate_tensors()

        # Get input and output details
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        print("Input details:")
        for i, detail in enumerate(input_details):
            print(
                f"  Input {i}: {detail['name']}, shape: {detail['shape']}, dtype: {detail['dtype']}"
            )

        print("Output details:")
        for i, detail in enumerate(output_details):
            print(
                f"  Output {i}: {detail['name']}, shape: {detail['shape']}, dtype: {detail['dtype']}"
            )

        # Convert TFLite to TensorFlow SavedModel first
        temp_saved_model_dir = os.path.join(output_dir, "temp_saved_model")

        # Create a simple TensorFlow function that mimics the TFLite model
        # Note: This is a simplified approach. For complex models, you might need
        # to recreate the model architecture

        @tf.function
        def tflite_inference(input_tensor):
            # Set input tensor
            interpreter.set_tensor(input_details[0]["index"], input_tensor.numpy())

            # Run inference
            interpreter.invoke()

            # Get output tensor
            output_data = interpreter.get_tensor(output_details[0]["index"])
            return tf.constant(output_data)

        # Create concrete function
        input_shape = input_details[0]["shape"]
        input_dtype = input_details[0]["dtype"]

        concrete_func = tflite_inference.get_concrete_function(
            tf.TensorSpec(shape=input_shape, dtype=input_dtype)
        )

        # Save as SavedModel
        tf.saved_model.save(
            concrete_func,
            temp_saved_model_dir,
            signatures={"serving_default": concrete_func},
        )

        print(f"Saved temporary SavedModel to {temp_saved_model_dir}")

        # Convert SavedModel to TensorFlow.js
        tfjs_model_dir = os.path.join(output_dir, "tfjs_model")

        tfjs.converters.convert_tf_saved_model(
            temp_saved_model_dir,
            tfjs_model_dir,
            quantization_bytes=2,  # Quantize to reduce model size
            metadata={"inputDetails": input_details, "outputDetails": output_details},
        )

        print(f"Converted model saved to {tfjs_model_dir}")

        # Clean up temporary files
        shutil.rmtree(temp_saved_model_dir)

        # Create model info file
        model_info = {
            "inputShape": input_details[0]["shape"].tolist(),
            "inputDtype": str(input_details[0]["dtype"]),
            "outputShape": output_details[0]["shape"].tolist(),
            "outputDtype": str(output_details[0]["dtype"]),
            "classNames": [
                "Longitudinal Crack",
                "Transverse Crack",
                "Alligator Crack",
                "Potholes",
            ],
            "inputSize": 640,
            "numClasses": 4,
        }

        import json

        with open(os.path.join(tfjs_model_dir, "model_info.json"), "w") as f:
            json.dump(model_info, f, indent=2)

        print("Model conversion completed successfully!")
        print(f"TensorFlow.js model files:")
        print(f"  - model.json")
        print(f"  - *.bin files")
        print(f"  - model_info.json")

        return tfjs_model_dir

    except Exception as e:
        print(f"Error during conversion: {e}")
        return None


def create_react_native_model_loader(tfjs_model_dir, output_file):
    """
    Create a React Native model loader utility.
    """

    loader_code = f"""
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import {{ bundleResourceIO }} from '@tensorflow/tfjs-react-native';

class ReactNativeYOLODetector {{
  constructor() {{
    this.model = null;
    this.isModelLoaded = false;
    this.modelInfo = null;
    
    // These will be loaded from model_info.json
    this.classNames = [
      "Longitudinal Crack",
      "Transverse Crack", 
      "Alligator Crack",
      "Potholes"
    ];
    
    this.inputSize = 640;
    this.numClasses = 4;
  }}

  async loadModel() {{
    try {{
      console.log('Loading YOLO model for React Native...');
      
      // Wait for TensorFlow.js to be ready
      await tf.ready();
      
      // Load the model from bundle
      const modelUrl = bundleResourceIO('./assets/models/tfjs_model/model.json');
      this.model = await tf.loadLayersModel(modelUrl);
      
      // Load model info
      const modelInfoResponse = await fetch('./assets/models/tfjs_model/model_info.json');
      this.modelInfo = await modelInfoResponse.json();
      
      this.classNames = this.modelInfo.classNames;
      this.inputSize = this.modelInfo.inputSize;
      this.numClasses = this.modelInfo.numClasses;
      
      this.isModelLoaded = true;
      console.log('YOLO model loaded successfully');
      return true;
    }} catch (error) {{
      console.error('Error loading model:', error);
      this.isModelLoaded = false;
      return false;
    }}
  }}

  async preprocessImage(imageUri, targetSize = 640) {{
    return new Promise((resolve, reject) => {{
      const image = new Image();
      image.crossOrigin = 'anonymous';
      
      image.onload = () => {{
        try {{
          // Create canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = targetSize;
          canvas.height = targetSize;
          
          // Draw and resize image
          ctx.drawImage(image, 0, 0, targetSize, targetSize);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
          
          // Convert to tensor and normalize
          const tensor = tf.browser.fromPixels(imageData)
            .expandDims(0)
            .div(255.0);
          
          resolve(tensor);
        }} catch (error) {{
          reject(error);
        }}
      }};
      
      image.onerror = reject;
      image.src = imageUri;
    }});
  }}

  async detectDamages(imageUri, confidenceThreshold = 0.5) {{
    if (!this.isModelLoaded) {{
      throw new Error('Model not loaded. Please load the model first.');
    }}

    try {{
      // Preprocess image
      const inputTensor = await this.preprocessImage(imageUri, this.inputSize);
      
      // Run inference
      const predictions = await this.model.predict(inputTensor);
      
      // Process predictions (this depends on your YOLO model output format)
      const detections = await this.processDetections(predictions, confidenceThreshold);
      
      // Clean up tensors
      inputTensor.dispose();
      predictions.dispose();
      
      return detections;
    }} catch (error) {{
      console.error('Error during detection:', error);
      throw error;
    }}
  }}

  async processDetections(predictions, confidenceThreshold) {{
    // Process YOLO predictions
    // This will need to be customized based on your specific model output format
    const detections = [];
    
    try {{
      const predictionData = await predictions.data();
      // Add your YOLO post-processing logic here
      
    }} catch (error) {{
      console.error('Error processing detections:', error);
    }}
    
    return detections;
  }}

  dispose() {{
    if (this.model) {{
      this.model.dispose();
    }}
    this.model = null;
    this.isModelLoaded = false;
  }}
}}

export default ReactNativeYOLODetector;
"""

    with open(output_file, "w") as f:
        f.write(loader_code)

    print(f"React Native model loader created: {output_file}")


def main():
    """Main conversion function"""

    # Paths
    tflite_path = "converted_models/YOLOv8_Small_RDD.tflite"
    output_dir = "mobile-app/assets/models"

    if not os.path.exists(tflite_path):
        print(f"Error: TFLite model not found at {tflite_path}")
        print("Please ensure the TFLite model exists.")
        return

    # Convert model
    tfjs_model_dir = tflite_to_tfjs(tflite_path, output_dir)

    if tfjs_model_dir:
        # Create React Native model loader
        loader_output = "mobile-app/utils/ReactNativeYOLODetector.js"
        create_react_native_model_loader(tfjs_model_dir, loader_output)

        print("\\n" + "=" * 50)
        print("Conversion completed successfully!")
        print("=" * 50)
        print(f"Model files saved to: {tfjs_model_dir}")
        print(f"Model loader created: {loader_output}")
        print("\\nNext steps:")
        print(
            "1. Copy the tfjs_model folder to your React Native app's assets/models/ directory"
        )
        print("2. Use the ReactNativeYOLODetector class in your React Native app")
        print("3. Make sure to bundle the model files with your app")
    else:
        print("Conversion failed!")


if __name__ == "__main__":
    main()
