import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
} from "react-native";
import {
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
} from "react-native-paper";
import ApiService from "../utils/ApiService";

const HistoryScreen = () => {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  useEffect(() => {
    loadDetections();
    loadStats();
  }, []);

  const loadDetections = async () => {
    try {
      const detectionsData = await ApiService.getDetections();
      setDetections(detectionsData);
    } catch (error) {
      Alert.alert("Error", "Failed to load detection history");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await ApiService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDetections();
    await loadStats();
    setRefreshing(false);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDamageColor = (damageType) => {
    const colors = {
      "Longitudinal Crack": "#ffeb3b",
      "Transverse Crack": "#ff9800",
      "Alligator Crack": "#f44336",
      Potholes: "#9c27b0",
    };
    return colors[damageType] || "#2196f3";
  };

  const openImageModal = (detectionId) => {
    // Use ApiService to get the correct image URL
    const imageUrl = ApiService.getImageUrl(detectionId);
    console.log("Opening image modal with URL:", imageUrl);
    setSelectedImageUrl(imageUrl);
    setModalVisible(true);
  };

  const closeImageModal = () => {
    setModalVisible(false);
    setSelectedImageUrl(null);
  };

  const openLocationInMaps = (latitude, longitude) => {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    Linking.openURL(url).catch((err) => {
      console.error("Error opening maps:", err);
      Alert.alert("Error", "Could not open maps application");
    });
  };

  const renderDetectionItem = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Title>Detection #{item.id}</Title>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => openImageModal(item.id)}
            >
              <Image
                source={{ uri: ApiService.getImageUrl(item.id) }}
                style={styles.thumbnailImage}
                resizeMode="cover"
                onError={(error) =>
                  console.log("Thumbnail image error:", error)
                }
                onLoad={() =>
                  console.log("Thumbnail loaded for detection:", item.id)
                }
              />
              <View style={styles.imageOverlay}>
                <IconButton icon="eye" iconColor="#fff" size={20} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Paragraph>
          Location: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
          <TouchableOpacity
            onPress={() => openLocationInMaps(item.latitude, item.longitude)}
            style={styles.mapLinkButton}
          >
            <Text style={styles.mapLinkText}> 📍 Open in Maps</Text>
          </TouchableOpacity>
        </Paragraph>
        <Paragraph>Time: {formatTimestamp(item.timestamp)}</Paragraph>

        <View style={styles.damageContainer}>
          <Paragraph style={styles.damageTitle}>Detected Damages:</Paragraph>
          {item.detected_damages.length > 0 ? (
            item.detected_damages.map((damage, index) => (
              <Chip
                key={index}
                style={[
                  styles.damageChip,
                  { backgroundColor: getDamageColor(damage.class) },
                ]}
                textStyle={styles.chipText}
              >
                {damage.class} ({(damage.confidence * 100).toFixed(1)}%)
              </Chip>
            ))
          ) : (
            <Paragraph>No damages detected</Paragraph>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderStats = () => {
    if (!stats) return null;

    return (
      <Card style={styles.statsCard}>
        <Card.Content>
          <Title>Statistics</Title>
          <Paragraph>Total Detections: {stats.total_detections}</Paragraph>

          <View style={styles.damageStatsContainer}>
            <Paragraph style={styles.damageTitle}>
              Damage Distribution:
            </Paragraph>
            {Object.entries(stats.damage_type_distribution).map(
              ([type, count]) => (
                <View key={type} style={styles.statRow}>
                  <Chip
                    style={[
                      styles.statChip,
                      { backgroundColor: getDamageColor(type) },
                    ]}
                    textStyle={styles.chipText}
                  >
                    {type}: {count}
                  </Chip>
                </View>
              )
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const content = (
    <FlatList
      data={detections}
      renderItem={renderDetectionItem}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={renderStats}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={styles.listContainer}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No detections found</Text>
          <Button mode="outlined" onPress={onRefresh}>
            Refresh
          </Button>
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading detection history...</Text>
        </View>
      ) : (
        content
      )}

      {/* Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={closeImageModal}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeImageModal}
              >
                <IconButton icon="close" iconColor="#fff" size={30} />
              </TouchableOpacity>

              {selectedImageUrl && (
                <Image
                  source={{ uri: selectedImageUrl }}
                  style={[
                    styles.modalImage,
                    {
                      width: screenWidth * 0.9,
                      height: screenHeight * 0.7,
                    },
                  ]}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 20,
    paddingTop: 12,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
    borderRadius: 18,
    overflow: "hidden",
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  imageButton: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  statsCard: {
    marginBottom: 20,
    elevation: 4,
    backgroundColor: "#e3f2fd",
    borderRadius: 20,
  },
  damageContainer: {
    marginTop: 8,
  },
  damageStatsContainer: {
    marginTop: 8,
  },
  damageTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  damageChip: {
    margin: 2,
    alignSelf: "flex-start",
  },
  statChip: {
    margin: 2,
  },
  chipText: {
    color: "#000",
    fontSize: 12,
  },
  statRow: {
    flexDirection: "row",
    marginVertical: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    color: "#6b7280",
    marginBottom: 16,
  },
  loadingText: {
    color: "#6b7280",
    marginTop: 12,
  },
  // Map link styles
  mapLinkButton: {
    marginLeft: 8,
  },
  mapLinkText: {
    color: "#2196f3",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    borderRadius: 8,
  },
  closeButton: {
    position: "absolute",
    top: -50,
    right: 10,
    zIndex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
  },
});

export default HistoryScreen;
