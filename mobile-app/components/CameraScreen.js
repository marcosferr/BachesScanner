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
import * as FileSystem from "expo-file-system";
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
      console.log("CameraScreen focused");
      // Reset camera when screen is focused
      const resetCamera = async () => {
        if (hasCameraPermission) {
          setCameraKey((prev) => prev + 1); // Force camera re-render
          checkServerConnection();
        }
      };
      resetCamera();

      return () => {
        console.log("CameraScreen unfocused - stopping real-time inference");
        // Stop real-time inference when leaving the screen
        stopRealTimeInference();
        setIsRealTimeMode(false); // Also turn off the mode
      };
    }, [hasCameraPermission])
  );

  useEffect(() => {
    requestPermissions();
    checkServerConnection();

    // Cleanup function when component unmounts
    return () => {
      console.log("CameraScreen component unmounting - cleanup");
      stopRealTimeInference();
    };
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

            // First try with base64 directly
            let photo = await Promise.race([
              cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true,
                skipProcessing: false, // Try with processing enabled
                exif: false, // Disable exif to reduce size
              }),
              new Promise(
                (_, reject) =>
                  setTimeout(() => reject(new Error("capture-timeout")), 10000) // Increase timeout
              ),
            ]);

            // If base64 is missing, try alternative approach
            if (!photo.base64 && photo.uri) {
              console.log("Base64 missing, trying to convert URI to base64...");

              // Try taking another photo without base64 and then convert
              const photoWithoutBase64 =
                await cameraRef.current.takePictureAsync({
                  quality: 0.7,
                  base64: false,
                });

              // Use FileSystem to read as base64
              const base64 = await FileSystem.readAsStringAsync(
                photoWithoutBase64.uri,
                {
                  encoding: FileSystem.EncodingType.Base64,
                }
              );

              photo = {
                ...photoWithoutBase64,
                base64: base64,
              };
            }

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

      // Debug: Log the photo object structure
      console.log("Photo object:", {
        uri: photo?.uri ? "present" : "missing",
        base64: photo?.base64
          ? `present (${photo.base64.length} chars)`
          : "missing/null",
        width: photo?.width,
        height: photo?.height,
      });

      // Validate that we have a base64 image
      if (!photo || !photo.base64) {
        console.error("Photo capture failed - no base64 data:", photo);
        throw new Error(
          `Failed to capture image as base64. Photo object: ${JSON.stringify(
            photo
          )}`
        );
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
      // Get current location before saving
      let currentLocation = location;
      if (hasLocationPermission) {
        try {
          currentLocation = await getCurrentLocation();
        } catch (error) {
          console.warn(
            "Could not get current location for saving, using last known location"
          );
        }
      }

      // Extract base64 from the annotated image
      const base64Image =
        lastInferenceResult.annotated_image_base64.split(",")[1];

      const result = await ApiService.sendDetectionResult(
        base64Image,
        currentLocation?.latitude || 0,
        currentLocation?.longitude || 0,
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
          {/* Top overlay controls */}
          <View style={styles.topControls}>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: serverConnected ? "#059669" : "#dc2626" },
                ]}
              >
                <Text style={styles.statusText}>
                  {serverConnected ? "Server Connected" : "Server Offline"}
                </Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: location ? "#059669" : "#dc2626",
                    marginTop: 4,
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  {location ? "📍 GPS Active" : "📍 GPS Unavailable"}
                </Text>
              </View>
            </View>

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
              <Text style={styles.flipButtonText}>Flip</Text>
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
      </View>

      {/* Controls Panel */}
      <View style={styles.controlsPanel}>
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* Real-time Mode Toggle */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Real-time Detection</Text>
          <Switch
            value={isRealTimeMode}
            onValueChange={setIsRealTimeMode}
            disabled={!serverConnected}
          />
        </View>

        {/* Current Location Display */}
        {location && (
          <View style={styles.locationCard}>
            <Text style={styles.locationCardTitle}>📍 Current Location</Text>
            <Text style={styles.locationCardText}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Detection Info */}
        {lastInferenceResult && (
          <View style={styles.detectionCard}>
            <Text style={styles.detectionTitle}>Latest Detection</Text>
            <Text style={styles.detectionCount}>
              Found: {lastInferenceResult.detection_count} damage(s)
            </Text>
            {lastInferenceResult.detections.map((detection, index) => (
              <Text key={index} style={styles.detectionItem}>
                • {detection.class}: {(detection.confidence * 100).toFixed(1)}%
              </Text>
            ))}
            {lastInferenceResult.location && (
              <Text style={styles.locationInfo}>
                📍 {lastInferenceResult.location.latitude.toFixed(6)},{" "}
                {lastInferenceResult.location.longitude.toFixed(6)}
              </Text>
            )}
            <Text style={styles.timestamp}>
              {new Date(lastInferenceResult.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.detectButton,
              {
                backgroundColor:
                  isProcessing || !serverConnected || isRealTimeMode
                    ? "#93c5fd"
                    : "#2563eb",
              },
            ]}
            onPress={() => captureAndInfer(false)}
            disabled={isProcessing || !serverConnected || isRealTimeMode}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Detect</Text>
            )}
          </TouchableOpacity>

          {lastInferenceResult?.detections?.length > 0 && (
            <TouchableOpacity
              style={[styles.detectButton, styles.saveButton]}
              onPress={saveCurrentResult}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          )}

          {lastInferenceResult && (
            <TouchableOpacity
              style={[styles.detectButton, styles.clearButton]}
              onPress={clearResults}
            >
              <Text style={styles.buttonText}>Clear</Text>
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
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 10,
  },
  statusContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  flipButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  flipButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
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
  controlsPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    borderRadius: 3,
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  locationCard: {
    backgroundColor: "#f0f9ff",
    borderColor: "#bae6fd",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  locationCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 4,
  },
  locationCardText: {
    fontSize: 12,
    color: "#0c4a6e",
    fontFamily: "monospace",
  },
  detectionCard: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#15803d",
    marginBottom: 4,
  },
  detectionCount: {
    color: "#166534",
    marginBottom: 8,
  },
  detectionItem: {
    fontSize: 14,
    color: "#15803d",
    marginBottom: 2,
  },
  locationInfo: {
    fontSize: 12,
    color: "#16a34a",
    fontStyle: "italic",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    color: "#16a34a",
    fontStyle: "italic",
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  detectButton: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  saveButton: {
    backgroundColor: "#16a34a",
  },
  clearButton: {
    backgroundColor: "#f97316",
    width: "100%",
    marginTop: 12,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CameraScreen;
