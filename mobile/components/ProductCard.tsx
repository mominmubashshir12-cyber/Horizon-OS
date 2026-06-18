// components/ProductCard.tsx
// A touchable card component for displaying product information in lists.
// Shows the product name, SKU, category, customer price with ₹ symbol,
// and current stock quantity with a low-stock warning indicator.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Package, ChevronRight, AlertTriangle } from 'lucide-react-native';
import type { Product } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductCardProps {
  /** The product data to display */
  product: Product;
  /** Callback invoked when the card is pressed */
  onPress: () => void;
}

// ─── Price Formatting ─────────────────────────────────────────────────────────

/**
 * Formats a numeric value as Indian Rupee currency.
 */
function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ProductCard({
  product,
  onPress,
}: ProductCardProps): React.JSX.Element {
  const isLowStock = product.currentStock <= product.reorderLevel;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-[#1e293b] rounded-xl border border-[#334155] mb-3 p-4"
    >
      {/* Top Row: Icon + Name + Price */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-3">
          <View className="bg-blue-900/40 rounded-lg p-2 mr-3">
            <Package size={20} color="#60a5fa" />
          </View>
          <View className="flex-1">
            <Text
              className="text-slate-50 font-semibold text-base"
              numberOfLines={1}
            >
              {product.name}
            </Text>
            <Text className="text-slate-400 text-sm">
              SKU: {product.sku}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-green-400 font-bold text-base">
            {formatPrice(product.customerPrice)}
          </Text>
        </View>
      </View>

      {/* Bottom Row: Category, Stock, Chevron */}
      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center flex-1">
          {/* Category Pill */}
          <View className="bg-slate-700 rounded px-2 py-0.5 mr-3">
            <Text className="text-slate-300 text-xs">{product.category}</Text>
          </View>

          {/* Stock Indicator */}
          <View className="flex-row items-center">
            {isLowStock ? (
              <AlertTriangle size={12} color="#f59e0b" />
            ) : null}
            <Text
              className={`text-xs ml-1 ${
                isLowStock ? 'text-yellow-400' : 'text-slate-400'
              }`}
            >
              Stock: {product.currentStock} {product.unit}
              {isLowStock ? ' (Low)' : ''}
            </Text>
          </View>
        </View>

        <ChevronRight size={18} color="#64748b" />
      </View>
    </TouchableOpacity>
  );
}
