// API configuration
const API_BASE_URL = "http://YOUR_SERVER_IP:5000/api"; // Replace with your server IP

class ApiService {
  static async runInference(
    imageBase64,
    confidenceThreshold = 0.5,
    saveResult = false,
    latitude = null,
    longitude = null
  ) {
    try {
      const payload = {
        image_base64: imageBase64,
        confidence_threshold: confidenceThreshold,
        save_result: saveResult,
      };

      // Add location if saving result
      if (saveResult && latitude !== null && longitude !== null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      const response = await fetch(`${API_BASE_URL}/infer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to run inference");
      }

      return result;
    } catch (error) {
      console.error("Error running inference:", error);
      throw error;
    }
  }

  static async sendDetectionResult(
    imageBase64,
    latitude,
    longitude,
    detectedDamages
  ) {
    try {
      const response = await fetch(`${API_BASE_URL}/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          latitude: latitude,
          longitude: longitude,
          detected_damages: detectedDamages,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to send detection result");
      }

      return result;
    } catch (error) {
      console.error("Error sending detection result:", error);
      throw error;
    }
  }

  static async getDetections() {
    try {
      const response = await fetch(`${API_BASE_URL}/detections`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch detections");
      }

      return result.detections;
    } catch (error) {
      console.error("Error fetching detections:", error);
      throw error;
    }
  }

  static async getDetection(detectionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/detections/${detectionId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch detection");
      }

      return result.detection;
    } catch (error) {
      console.error("Error fetching detection:", error);
      throw error;
    }
  }

  static async getStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch stats");
      }

      return result.stats;
    } catch (error) {
      console.error("Error fetching stats:", error);
      throw error;
    }
  }

  static async checkServerHealth() {
    try {
      const response = await fetch(`${API_BASE_URL.replace("/api", "")}/`);
      const result = await response.json();

      return response.ok && result.status === "success";
    } catch (error) {
      console.error("Server health check failed:", error);
      return false;
    }
  }
}

export default ApiService;
