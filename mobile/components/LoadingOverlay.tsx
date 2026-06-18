// components/LoadingOverlay.tsx
// A full-screen semi-transparent overlay with a centered loading spinner.
// Used during async operations (login, data fetching, sync) to block
// interaction and indicate progress. Supports an optional message.

import React from 'react';
import { View, Text, ActivityIndicator, Modal } from 'react-native';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Optional message displayed below the spinner */
  message?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LoadingOverlay({
  visible,
  message,
}: LoadingOverlayProps): React.JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/60">
        <View className="bg-[#1e293b] rounded-2xl px-8 py-6 items-center border border-[#334155]">
          <ActivityIndicator size="large" color="#2563eb" />
          {message ? (
            <Text className="text-slate-300 text-sm mt-4 text-center">
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
