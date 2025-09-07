import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Text,
  Dimensions,
} from "react-native";
import { Camera } from "expo-camera";
import * as Location from "expo-location";
import { Button, Card, Title, Paragraph, Switch } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import ApiService from "../utils/ApiService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const CameraScreen = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);
  const [lastInferenceResult, setLastInferenceResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverConnected, setServerConnected] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [cameraKey, setCameraKey] = useState(0); // For forcing camera re-render
  const [cameraReady, setCameraReady] = useState(false); // Track camera readiness

  const cameraRef = useRef(null);
  const inferenceIntervalRef = useRef(null);

  // Handle camera focus when screen comes into view
  useFocusEffect(
    React.useCallback(() => {
      // Reset camera when screen is focused
      const resetCamera = async () => {
        if (hasCameraPermission) {
          setCameraKey((prev) => prev + 1); // Force camera re-render
          checkServerConnection();
        }
      };
      resetCamera();

      return () => {
        // Stop real-time inference when leaving the screen
        stopRealTimeInference();
      };
    }, [hasCameraPermission])
  );

  useEffect(() => {
    requestPermissions();
    checkServerConnection();
  }, []);

  useEffect(() => {
    if (isRealTimeMode && serverConnected) {
      startRealTimeInference();
    } else {
      stopRealTimeInference();
    }

    return () => stopRealTimeInference();
  }, [isRealTimeMode, serverConnected]);

  const requestPermissions = async () => {
    // Camera permission
    const cameraStatus = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(cameraStatus.status === "granted");

    // Location permission
    const locationStatus = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(locationStatus.status === "granted");

    setHasPermission(
      cameraStatus.status === "granted" && locationStatus.status === "granted"
    );

    // Get initial location
    if (locationStatus.status === "granted") {
      getCurrentLocation();
    }
  };

  const checkServerConnection = async () => {
    try {
      const isHealthy = await ApiService.checkServerHealth();
      setServerConnected(isHealthy);
    } catch (error) {
      setServerConnected(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setLocation(newLocation);
      return newLocation;
    } catch (error) {
      console.error("Error getting location:", error);
      return location; // Return current state if new location fetch fails
    }
  };

  const captureAndInfer = async (saveResult = false) => {
    if (!cameraRef.current || isProcessing || !hasCameraPermission) return;
    if (!cameraReady) {
      console.log("captureAndInfer: Camera not ready yet");
      return;
    }

    try {
      setIsProcessing(true);
      console.log("captureAndInfer: Starting capture. saveResult=", saveResult);

      // Small delay to ensure stability after UI interactions
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Robust capture with timeout & retries
      const takePhotoWithRetry = async (retries = 2) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            console.log(
              `captureAndInfer: Attempt ${attempt + 1} to take picture`
            );
            const photo = await Promise.race([
              cameraRef.current.takePictureAsync({
                quality: 0.6, // slightly lower for speed
                base64: true,
                skipProcessing: true, // faster & avoids some Android stalls
                fastMode: true,
              }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("capture-timeout")), 7000)
              ),
            ]);
            return photo;
          } catch (err) {
            console.warn(
              "captureAndInfer: takePictureAsync failed",
              err.message
            );
            if (attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      };

      // Take picture
      const photo = await takePhotoWithRetry();

      // Validate that we have a base64 image
      if (!photo.base64) {
        throw new Error("Failed to capture image as base64");
      }

      console.log("Captured photo - base64 length:", photo.base64.length);

      // Get current location if saving
      let currentLocation = location;
      if (saveResult && hasLocationPermission) {
        try {
          currentLocation = await getCurrentLocation();
        } catch (error) {
          console.warn(
            "Could not get current location, using last known location"
          );
          currentLocation = location;
        }
      }

      // Prepare the base64 image with proper format
      const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;

      // Run inference on server
      const result = await ApiService.runInference(
        imageBase64,
        confidenceThreshold,
        saveResult,
        currentLocation?.latitude,
        currentLocation?.longitude
      );
      console.log(
        "captureAndInfer: Inference success. Detections:",
        result?.detection_count
      );

      setLastInferenceResult({
        ...result,
        originalImage: photo.uri,
        location: currentLocation,
        timestamp: new Date().toISOString(),
      });

      if (saveResult && result.saved) {
        Alert.alert(
          "Success",
          `Detection saved! Found ${result.detection_count} damage(s)`
        );
      }
    } catch (error) {
      console.error("Error during capture and inference:", error);
      Alert.alert("Error", `Failed to process image: ${error.message}`);
    } finally {
      console.log("captureAndInfer: Finished");
      setIsProcessing(false);
    }
  };

  const startRealTimeInference = () => {
    if (inferenceIntervalRef.current) return;

    inferenceIntervalRef.current = setInterval(() => {
      if (!isProcessing && cameraRef.current) {
        captureAndInfer(false); // Don't save real-time results
      }
    }, 2000); // Run inference every 2 seconds
  };

  const stopRealTimeInference = () => {
    if (inferenceIntervalRef.current) {
      clearInterval(inferenceIntervalRef.current);
      inferenceIntervalRef.current = null;
    }
  };

  const saveCurrentResult = async () => {
    if (!lastInferenceResult || !lastInferenceResult.detections.length) {
      Alert.alert("No detections", "No damage detected to save");
      return;
    }

    try {
      // Extract base64 from the annotated image
      const base64Image =
        lastInferenceResult.annotated_image_base64.split(",")[1];

      const result = await ApiService.sendDetectionResult(
        base64Image,
        location?.latitude || 0,
        location?.longitude || 0,
        lastInferenceResult.detections
      );

      Alert.alert("Success", `Detection saved with ID: ${result.detection_id}`);
    } catch (error) {
      Alert.alert("Error", "Failed to save detection result");
    }
  };

  const clearResults = () => {
    setLastInferenceResult(null);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No access to camera or location</Text>
        <Button onPress={requestPermissions}>Grant Permissions</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <Camera
          key={cameraKey}
          style={styles.camera}
          type={type}
          ref={cameraRef}
          autoFocus={Camera.Constants.AutoFocus.on}
          onCameraReady={() => {
            console.log("Camera ready");
            setCameraReady(true);
          }}
          onMountError={(e) => {
            console.error("Camera mount error", e);
            Alert.alert("Camera Error", "Failed to initialize camera");
          }}
        >
          {/* Camera Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={() => {
                setType(
                  type === Camera.Constants.Type.back
                    ? Camera.Constants.Type.front
                    : Camera.Constants.Type.back
                );
              }}
            >
              <Text style={styles.buttonText}>Flip</Text>
            </TouchableOpacity>
          </View>

          {/* Inference Result Overlay */}
          {lastInferenceResult && (
            <View style={styles.resultOverlay}>
              <Image
                source={{ uri: lastInferenceResult.annotated_image_base64 }}
                style={styles.overlayImage}
                resizeMode="contain"
              />
            </View>
          )}
        </Camera>

        {/* Server Status Indicator */}
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: serverConnected ? "#4caf50" : "#f44336" },
          ]}
        >
          <Text style={styles.statusText}>
            {serverConnected ? "Server Connected" : "Server Disconnected"}
          </Text>
        </View>
      </View>

      {/* Controls Panel */}
      <View style={styles.controlsPanel}>
        {/* Real-time Mode Toggle */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Real-time Detection</Text>
          <Switch
            value={isRealTimeMode}
            onValueChange={setIsRealTimeMode}
            disabled={!serverConnected}
          />
        </View>

        {/* Detection Info */}
        {lastInferenceResult && (
          <Card style={styles.detectionCard}>
            <Card.Content>
              <Title>Latest Detection</Title>
              <Paragraph>
                Found: {lastInferenceResult.detection_count} damage(s)
              </Paragraph>
              {lastInferenceResult.detections.map((detection, index) => (
                <Paragraph key={index} style={styles.detectionItem}>
                  • {detection.class}: {(detection.confidence * 100).toFixed(1)}
                  %
                </Paragraph>
              ))}
              <Paragraph style={styles.timestamp}>
                {new Date(lastInferenceResult.timestamp).toLocaleTimeString()}
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              isProcessing && styles.disabledButton,
            ]}
            onPress={() => captureAndInfer(false)}
            disabled={isProcessing || !serverConnected || isRealTimeMode}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.captureButtonText}>Detect</Text>
            )}
          </TouchableOpacity>

          {lastInferenceResult && lastInferenceResult.detections.length > 0 && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveCurrentResult}
            >
              <Text style={styles.saveButtonText}>Save Result</Text>
            </TouchableOpacity>
          )}

          {lastInferenceResult && (
            <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  errorText: {
    color: "#f44336",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  topControls: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1,
  },
  flipButton: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
    borderRadius: 25,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  resultOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  overlayImage: {
    width: "100%",
    height: "100%",
  },
  statusIndicator: {
    position: "absolute",
    top: 40,
    left: 20,
    padding: 8,
    borderRadius: 15,
    zIndex: 1,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  controlsPanel: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 15,
    maxHeight: screenHeight * 0.4,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  detectionCard: {
    marginBottom: 15,
    backgroundColor: "#e8f5e8",
  },
  detectionItem: {
    fontSize: 14,
    marginVertical: 2,
  },
  timestamp: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  captureButton: {
    backgroundColor: "#2196f3",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    marginBottom: 10,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  captureButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  clearButton: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
    marginBottom: 10,
  },
  clearButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default CameraScreen;
