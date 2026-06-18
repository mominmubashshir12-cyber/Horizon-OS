// app/login.tsx
// Login screen for the Horizon OS mobile app.
// Professional dark-themed design with the company branding, username/password
// inputs, and a blue login button with loading state. Handles authentication
// via AuthContext and displays errors inline. On success, the root layout's
// navigation guard automatically redirects to (tabs).

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { AxiosError } from 'axios';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LoginScreen(): React.JSX.Element {
  const { login } = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleLogin = useCallback(async () => {
    // Validate inputs
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage('Username is required');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(trimmedUsername, password);
      // Navigation is handled by the root layout's auth guard
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const serverMessage =
          (error.response?.data as { message?: string })?.message ??
          (error.response?.data as { error?: string })?.error;

        if (error.response?.status === 401) {
          setErrorMessage(serverMessage ?? 'Invalid username or password');
        } else if (error.code === 'ECONNABORTED') {
          setErrorMessage('Connection timed out. Please try again.');
        } else if (!error.response) {
          setErrorMessage('Unable to connect to server. Check your network.');
        } else {
          setErrorMessage(serverMessage ?? 'Login failed. Please try again.');
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, login]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
          <View className="flex-1 justify-center px-8">
            {/* ── Branding ─────────────────────────────────────────── */}
            <View className="items-center mb-12">
              {/* Logo Icon */}
              <View className="bg-blue-600 rounded-2xl p-4 mb-6">
                <Shield size={40} color="#ffffff" />
              </View>

              {/* Company Name */}
              <Text className="text-slate-50 text-3xl font-bold text-center">
                Horizon IT Solutions
              </Text>

              {/* Subtitle */}
              <Text className="text-slate-400 text-base mt-2 text-center">
                Business Operating System
              </Text>
            </View>

            {/* ── Error Message ─────────────────────────────────── */}
            {errorMessage ? (
              <View className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-400 text-sm text-center">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {/* ── Username Input ─────────────────────────────────── */}
            <View className="mb-4">
              <Text className="text-slate-400 text-sm font-medium mb-2 ml-1">
                Username
              </Text>
              <TextInput
                className="bg-[#1e293b] border border-[#334155] rounded-xl px-4 py-3.5 text-slate-50 text-base"
                placeholder="Enter your username"
                placeholderTextColor="#64748b"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                editable={!isSubmitting}
              />
            </View>

            {/* ── Password Input ─────────────────────────────────── */}
            <View className="mb-6">
              <Text className="text-slate-400 text-sm font-medium mb-2 ml-1">
                Password
              </Text>
              <View className="relative">
                <TextInput
                  className="bg-[#1e293b] border border-[#334155] rounded-xl px-4 py-3.5 text-slate-50 text-base pr-12"
                  placeholder="Enter your password"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  onPress={togglePasswordVisibility}
                  className="absolute right-3 top-3.5"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={22} color="#64748b" />
                  ) : (
                    <Eye size={22} color="#64748b" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Login Button ───────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.8}
              className={`rounded-xl py-4 items-center ${
                isSubmitting ? 'bg-blue-800' : 'bg-[#2563eb]'
              }`}
            >
              {isSubmitting ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text className="text-white font-semibold text-base ml-2">
                    Signing In...
                  </Text>
                </View>
              ) : (
                <Text className="text-white font-semibold text-base">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* ── Footer ─────────────────────────────────────────── */}
            <Text className="text-slate-500 text-xs text-center mt-8">
              Horizon OS v1.0.0 • Mobile
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
