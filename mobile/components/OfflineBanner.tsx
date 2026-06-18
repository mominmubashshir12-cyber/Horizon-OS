// components/OfflineBanner.tsx
// A persistent banner displayed at the top of the screen when the device
// is offline. Warns the user that changes will be queued and synced
// automatically when connectivity is restored.
// Renders nothing (null) when the device is online.

import React from 'react';
import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetwork } from '../contexts/NetworkContext';

export default function OfflineBanner(): React.JSX.Element | null {
  const { isOnline } = useNetwork();

  if (isOnline) {
    return null;
  }

  return (
    <View className="bg-red-600 px-4 py-2 flex-row items-center justify-center">
      <WifiOff size={16} color="#ffffff" />
      <Text className="text-white text-sm font-medium ml-2">
        You are offline. Changes will sync when connected.
      </Text>
    </View>
  );
}
