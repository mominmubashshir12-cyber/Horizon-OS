// app/(tabs)/_layout.tsx
// Tab navigator layout for the Horizon OS mobile app.
// Defines all bottom tab screens with lucide-react-native icons.
// Role-based visibility: Team and Inventory tabs are only shown for OWNER and ADMIN users.
// Tab bar is styled with the dark theme to match the rest of the app.

import React from 'react';
import { Tabs } from 'expo-router';
import {
  House,
  ClipboardList,
  Package,
  User,
  Users,
  Boxes,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Roles that have access to management tabs (Team, Inventory) */
const MANAGEMENT_ROLES: UserRole[] = ['OWNER', 'ADMIN'];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TabsLayout(): React.JSX.Element {
  const { user } = useAuth();

  const isManagement = user ? MANAGEMENT_ROLES.includes(user.role) : false;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0f172a',
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: '#f8fafc',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* ── Home Tab ────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Horizon OS',
          tabBarIcon: ({ color, size }) => (
            <House size={size} color={color} />
          ),
        }}
      />

      {/* ── Jobs Tab ────────────────────────────────────────── */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          headerTitle: 'Job Cards',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />

      {/* ── Products Tab ────────────────────────────────────── */}
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          headerTitle: 'Product Catalog',
          tabBarIcon: ({ color, size }) => (
            <Package size={size} color={color} />
          ),
        }}
      />

      {/* ── Team Tab (Owner/Admin only) ─────────────────────── */}
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          headerTitle: 'Team Management',
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
          href: isManagement ? '/team' : null,
        }}
      />

      {/* ── Inventory Tab (Owner/Admin only) ────────────────── */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          headerTitle: 'Inventory',
          tabBarIcon: ({ color, size }) => (
            <Boxes size={size} color={color} />
          ),
          href: isManagement ? '/inventory' : null,
        }}
      />

      {/* ── Profile Tab ─────────────────────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />

      {/* ── Hidden: Job Detail (nested route, not a tab) ───── */}
      <Tabs.Screen
        name="jobs/[id]"
        options={{
          href: null,
          headerTitle: 'Job Details',
        }}
      />
    </Tabs>
  );
}
