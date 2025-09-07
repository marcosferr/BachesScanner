import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

// Import screens
import CameraScreen from "./components/CameraScreen";
import HistoryScreen from "./components/HistoryScreen";
import SettingsScreen from "./components/SettingsScreen";

const Tab = createBottomTabNavigator();

const theme = {
  colors: {
    primary: "#2196f3",
    accent: "#ff6b6b",
    background: "#f5f5f5",
    surface: "#ffffff",
    text: "#000000",
    placeholder: "#757575",
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                if (route.name === "Camera") {
                  iconName = "camera-alt";
                } else if (route.name === "History") {
                  iconName = "history";
                } else if (route.name === "Settings") {
                  iconName = "settings";
                }

                return <Icon name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: "gray",
              headerStyle: {
                backgroundColor: theme.colors.primary,
              },
              headerTintColor: "#fff",
              headerTitleStyle: {
                fontWeight: "bold",
              },
            })}
          >
            <Tab.Screen
              name="Camera"
              component={CameraScreen}
              options={{
                title: "Road Damage Detection",
              }}
            />
            <Tab.Screen
              name="History"
              component={HistoryScreen}
              options={{
                title: "Detection History",
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: "Settings",
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
