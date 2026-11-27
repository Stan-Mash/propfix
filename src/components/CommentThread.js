import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  collection, addDoc, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

const ROLE_COLORS = {
  landlord: colors.purple,
  manager: colors.primaryMid,
  caretaker: colors.success,
  contractor: colors.amber,
};

export default function CommentThread({ complaintId }) {
  const { userProfile } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, 'complaints', complaintId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [complaintId]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'complaints', complaintId, 'comments'), {
        text: trimmed,
        authorId: userProfile.uid,
        authorName: userProfile.name,
        role: userProfile.role,
        createdAt: new Date().toISOString(),
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  const isMine = c => c.authorId === userProfile?.uid;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Discussion</Text>

      {loading ? (
        <ActivityIndicator color={colors.primaryMid} style={{ marginVertical: 16 }} />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>No messages yet. Start the conversation.</Text>
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={c => c.id}
          scrollEnabled={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = isMine(item);
            const roleColor = ROLE_COLORS[item.role] || colors.textMuted;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!mine && (
                  <Text style={[styles.sender, { color: roleColor }]}>
                    {item.authorName} · {item.role}
                  </Text>
                )}
                <Text style={[styles.messageText, mine && styles.messageTextMine]}>{item.text}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {new Date(item.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <MaterialIcons name="send" size={16} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 8 },
  heading: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12, fontStyle: 'italic' },
  bubble: { maxWidth: '80%', marginBottom: 10, padding: 10, borderRadius: radius.md },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primaryMid, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  sender: { fontSize: 11, fontWeight: '700', marginBottom: 3, textTransform: 'capitalize' },
  messageText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  messageTextMine: { color: '#fff' },
  time: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  timeMine: { color: 'rgba(255,255,255,0.6)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  input: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.surfaceAlt, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryMid, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.primaryLight },
});
