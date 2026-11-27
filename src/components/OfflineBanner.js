import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      if (!offline && wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 2500);
      }
      setWasOffline(offline);
    });
    return unsub;
  }, [wasOffline]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline || showReconnected ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isOffline, showReconnected]);

  if (!isOffline && !showReconnected) return null;

  return (
    <Animated.View style={[styles.banner, showReconnected && styles.bannerOnline, { opacity }]}>
      <MaterialIcons
        name={showReconnected ? 'checkmark-circle' : 'cloud-offline-outline'}
        size={15}
        color="#fff"
      />
      <Text style={styles.text}>
        {showReconnected ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#374151', paddingVertical: 8, paddingHorizontal: 16,
  },
  bannerOnline: { backgroundColor: '#16A34A' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
