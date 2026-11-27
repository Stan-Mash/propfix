import React from 'react';
import { View, Text, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../data/seed';

export default function RepairPhoto({ photo, category, style, iconSize = 28, showLabel = false, resizeMode = 'cover' }) {
  const uri = typeof photo === 'string' ? photo : photo?.uri;

  if (photo?.type === 'video') {
    return (
      <View style={[style, { backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialIcons name="play-circle-filled" size={iconSize} color="#fff" />
        {showLabel && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 }}>Video {photo.duration || ''}</Text>}
      </View>
    );
  }

  if (uri) return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;

  const color = CATEGORY_COLORS[category] || '#475569';
  return (
    <View style={[style, { backgroundColor: color + '1A', justifyContent: 'center', alignItems: 'center', padding: 6 }]}>
      <MaterialIcons name={CATEGORY_ICONS[category] || 'build'} size={iconSize} color={color} />
      {showLabel && photo?.label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>{photo.label}</Text>
      ) : null}
    </View>
  );
}
