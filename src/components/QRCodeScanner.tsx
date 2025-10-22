import { useCameraPermissions } from "expo-camera";
import { Button, Text, View } from "react-native";

export default function QRCodeScanner() {
  const [permission, requestPermission] = useCameraPermissions();

  // Camera permissions are still loading
  if (!permission) {
    return (
      <View>
        <Text>Requesting camera permissions...</Text>
      </View>
    );
  }

  // Camera permissions are denied
  if (permission.status === "denied") {
    return (
      <View>
        <Text>Camera permissions are required to scan QR codes.</Text>
        <Button title="Grant Permissions" onPress={requestPermission} />
      </View>
    );
  }

  // Camera permissions are granted
  return (
    <View>
      <Text>Camera permissions are granted.</Text>
    </View>
  );
}


