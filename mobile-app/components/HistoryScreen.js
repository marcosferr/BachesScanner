import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Text,
} from "react-native";
import {
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Button,
  Chip,
} from "react-native-paper";
import ApiService from "../utils/ApiService";

const HistoryScreen = () => {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

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

  const renderDetectionItem = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Title>Detection #{item.id}</Title>
        <Paragraph>
          Location: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
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
        <View className="items-center justify-center py-20">
          <Text className="text-gray-600 mb-4">No detections found</Text>
          <Button mode="outlined" onPress={onRefresh}>
            Refresh
          </Button>
        </View>
      )}
    />
  );

  return (
    <View className="flex-1 bg-gray-50">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="text-gray-600 mt-3">
            Loading detection history...
          </Text>
        </View>
      ) : (
        content
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    padding: 40,
  },
});

export default HistoryScreen;
