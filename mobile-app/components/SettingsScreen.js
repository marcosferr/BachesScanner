import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert, Text } from "react-native";
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  Switch,
  Divider,
  ActivityIndicator,
} from "react-native-paper";
import ApiService from "../utils/ApiService";

const SettingsScreen = () => {
  const [serverUrl, setServerUrl] = useState("http://192.168.100.4:5000");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0.5");
  const [autoUpload, setAutoUpload] = useState(true);
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [serverStatus, setServerStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkServerConnection();
  }, []);

  const checkServerConnection = async () => {
    setTesting(true);
    try {
      const isHealthy = await ApiService.checkServerHealth();
      setServerStatus(isHealthy ? "Connected" : "Disconnected");
    } catch (error) {
      setServerStatus("Error");
    } finally {
      setTesting(false);
    }
  };

  const testConnection = async () => {
    // Update API service with new URL
    // Note: You'll need to modify ApiService to accept dynamic URLs
    setTesting(true);

    try {
      // Simulate connection test
      const response = await fetch(`${serverUrl}/`);
      const result = await response.json();

      if (response.ok && result.status === "success") {
        setServerStatus("Connected");
        Alert.alert("Success", "Server connection successful!");
      } else {
        setServerStatus("Disconnected");
        Alert.alert("Error", "Server connection failed");
      }
    } catch (error) {
      setServerStatus("Error");
      Alert.alert("Error", "Failed to connect to server");
    } finally {
      setTesting(false);
    }
  };

  const resetSettings = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all settings to default?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setServerUrl("http://192.168.100.4:5000");
            setConfidenceThreshold("0.5");
            setAutoUpload(true);
            setSaveToGallery(true);
            Alert.alert("Success", "Settings reset to default");
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (serverStatus) {
      case "Connected":
        return "#4caf50";
      case "Disconnected":
        return "#f44336";
      case "Error":
        return "#ff9800";
      default:
        return "#757575";
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 px-4 pt-4"
      style={styles.container}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Title style={{ marginBottom: 4 }}>Server Configuration</Title>

          <TextInput
            label="Server URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            mode="outlined"
            style={styles.input}
            placeholder="http://192.168.100.4:5000"
          />

          <View className="flex-row items-center mt-2 mb-2">
            <Paragraph className="mr-1">Status:</Paragraph>
            <Paragraph style={[styles.status, { color: getStatusColor() }]}>
              {testing ? "Testing..." : serverStatus || "Unknown"}
            </Paragraph>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={testConnection}
              disabled={testing}
              style={styles.button}
            >
              {testing ? <ActivityIndicator size="small" /> : "Test Connection"}
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Detection Settings</Title>

          <TextInput
            label="Confidence Threshold"
            value={confidenceThreshold}
            onChangeText={setConfidenceThreshold}
            mode="outlined"
            style={styles.input}
            placeholder="0.5"
            keyboardType="numeric"
          />
          <Paragraph style={styles.helper}>
            Minimum confidence level for damage detection (0.0 - 1.0)
          </Paragraph>

          <Button
            mode="outlined"
            onPress={() => {
              const threshold = parseFloat(confidenceThreshold);
              if (threshold >= 0 && threshold <= 1) {
                Alert.alert(
                  "Success",
                  `Confidence threshold set to ${threshold}`
                );
              } else {
                Alert.alert("Error", "Threshold must be between 0.0 and 1.0");
              }
            }}
            style={styles.button}
          >
            Apply Threshold
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>App Behavior</Title>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1 mr-4">
              <Paragraph>Auto-upload to server</Paragraph>
              <Paragraph style={styles.helper}>
                Automatically send detection results to server
              </Paragraph>
            </View>
            <Switch value={autoUpload} onValueChange={setAutoUpload} />
          </View>

          <Divider style={styles.divider} />

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1 mr-4">
              <Paragraph>Save photos to gallery</Paragraph>
              <Paragraph style={styles.helper}>
                Save captured photos to device gallery
              </Paragraph>
            </View>
            <Switch value={saveToGallery} onValueChange={setSaveToGallery} />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>App Information</Title>
          <Paragraph>Version: 1.0.0</Paragraph>
          <Paragraph>Model: YOLOv8 Small Road Damage Detection</Paragraph>
          <Paragraph>Classes: 4 damage types</Paragraph>
        </Card.Content>
      </Card>

      <View className="mt-4 mb-10">
        <Button mode="outlined" onPress={resetSettings} style={styles.button}>
          Reset to Default
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {},
  card: {
    marginBottom: 16,
    elevation: 4,
  },
  input: {
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  status: {
    fontWeight: "bold",
  },
  buttonContainer: {
    marginTop: 16,
  },
  button: {
    marginBottom: 8,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  divider: {
    marginVertical: 8,
  },
});

export default SettingsScreen;
