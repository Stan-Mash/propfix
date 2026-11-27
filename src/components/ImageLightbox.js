import React, { useState, useRef } from 'react';
import {
  Modal, View, Image, TouchableOpacity, StyleSheet,
  FlatList, Dimensions, StatusBar, Text, SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function ImageLightbox({ photos, initialIndex = 0, visible, onClose }) {
  const [current, setCurrent] = useState(initialIndex);
  const flatRef = useRef(null);

  const onScroll = e => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrent(idx);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.counter}>{current + 1} / {photos.length}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatRef}
          data={photos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const uri = typeof item === 'string' ? item : item?.uri;
            return (
              <View style={styles.page}>
                <Image source={{ uri }} style={styles.image} resizeMode="contain" />
              </View>
            );
          }}
        />

        {photos.length > 1 && (
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  counter: { color: '#fff', fontSize: 14, fontWeight: '600' },
  closeBtn: { padding: 4 },
  page: { width, height: height - 120, justifyContent: 'center', alignItems: 'center' },
  image: { width: width - 32, height: height - 160 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 18, borderRadius: 3 },
});
