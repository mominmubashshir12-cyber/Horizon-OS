import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { getOffline } from '../services/offline';

interface CheckInGuardProps {
  children: React.ReactNode;
}

export default function CheckInGuard({ children }: CheckInGuardProps): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkStatus = async () => {
        if (user?.role === 'OWNER' || user?.role === 'ADMIN') {
          if (isActive) setIsCheckedIn(true);
          return;
        }

        const cached = await getOffline<any>('attendance_today_status');
        if (isActive) {
          if (cached && cached.data) {
            setIsCheckedIn(!!cached.data.isCheckedIn);
          } else {
            setIsCheckedIn(false);
          }
        }
      };

      checkStatus();

      return () => {
        isActive = false;
      };
    }, [user?.role])
  );

  if (isCheckedIn === null) {
    return (
      <View className="flex-1 bg-[#0f172a] items-center justify-center">
        <ActivityIndicator color="#2563eb" size="large" />
      </View>
    );
  }

  if (!isCheckedIn) {
    return (
      <View className="flex-1 bg-[#0f172a] items-center justify-center px-6">
        <View className="bg-red-500/10 rounded-full p-4 mb-4">
          <AlertCircle size={48} color="#ef4444" />
        </View>
        <Text className="text-slate-50 font-bold text-2xl text-center mb-2">
          Action Required
        </Text>
        <Text className="text-slate-400 text-base text-center mb-8 px-4 leading-6">
          You must check in from the Home tab before accessing this section.
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)')}
          className="bg-blue-600 rounded-xl py-3.5 px-6 flex-row items-center justify-center shadow w-full max-w-xs"
        >
          <ArrowLeft size={20} color="#ffffff" />
          <Text className="text-white font-bold text-base ml-2">
            Go to Home
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}
