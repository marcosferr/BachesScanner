import React, { useState, useEffect, useRef } from "react";
import {
  View,
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
    <View className="flex-1 bg-black">
      {/* Camera View */}
      <View className="flex-1 relative">
        <Camera
          key={cameraKey}
          style={{ flex: 1 }}
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
          <View className="absolute top-10 left-0 right-0 px-5 flex-row justify-between items-center z-10">
            <View
              className={`px-3 py-1 rounded-full ${
                serverConnected ? "bg-green-600/80" : "bg-red-600/80"
              }`}
            >
              <Text className="text-white text-xs font-semibold">
                {serverConnected ? "Server Connected" : "Server Offline"}
              </Text>
            </View>

            <TouchableOpacity
              className="bg-black/60 px-4 py-2 rounded-full"
              onPress={() => {
                setType(
                  type === Camera.Constants.Type.back
                    ? Camera.Constants.Type.front
                    : Camera.Constants.Type.back
                );
              }}
            >
              <Text className="text-white font-semibold text-sm">Flip</Text>
            </TouchableOpacity>
          </View>

          {/* Inference Result Overlay */}
          {lastInferenceResult && (
            <View className="absolute inset-0 bg-black/30">
              <Image
                source={{ uri: lastInferenceResult.annotated_image_base64 }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
          )}
        </Camera>
      </View>

      {/* Controls Panel */}
      <View className="bg-white rounded-t-3xl px-5 pt-4 pb-6 shadow-xl">
        {/* Drag handle */}
        <View className="w-12 h-1.5 bg-gray-300 self-center rounded-full mb-4" />

        {/* Real-time Mode Toggle */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-base font-semibold text-gray-800">
            Real-time Detection
          </Text>
          <Switch
            value={isRealTimeMode}
            onValueChange={setIsRealTimeMode}
            disabled={!serverConnected}
          />
        </View>

        {/* Detection Info */}
        {lastInferenceResult && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <Text className="text-lg font-semibold text-green-700 mb-1">
              Latest Detection
            </Text>
            <Text className="text-green-800 mb-2">
              Found: {lastInferenceResult.detection_count} damage(s)
            </Text>
            {lastInferenceResult.detections.map((detection, index) => (
              <Text key={index} className="text-sm text-green-700 mb-0.5">
                • {detection.class}: {(detection.confidence * 100).toFixed(1)}%
              </Text>
            ))}
            <Text className="text-[11px] text-green-600 italic mt-2">
              {new Date(lastInferenceResult.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <TouchableOpacity
            className={`flex-1 mr-2 rounded-full py-3 items-center ${
              isProcessing || !serverConnected || isRealTimeMode
                ? "bg-blue-300"
                : "bg-blue-600"
            }`}
            onPress={() => captureAndInfer(false)}
            disabled={isProcessing || !serverConnected || isRealTimeMode}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Detect</Text>
            )}
          </TouchableOpacity>

          {lastInferenceResult?.detections?.length > 0 && (
            <TouchableOpacity
              className="flex-1 ml-2 rounded-full py-3 items-center bg-green-600"
              onPress={saveCurrentResult}
            >
              <Text className="text-white font-semibold text-base">Save</Text>
            </TouchableOpacity>
          )}

          {lastInferenceResult && (
            <TouchableOpacity
              className="w-full mt-3 rounded-full py-3 items-center bg-orange-500"
              onPress={clearResults}
            >
              <Text className="text-white font-semibold text-base">Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default CameraScreen;
