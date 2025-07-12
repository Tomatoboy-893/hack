// ChatScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { auth, db } from './firebaseConfig'; // Firebaseの認証とFirestoreインスタンスをインポート
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firestoreの関数をインポート

// メッセージデータの型定義
interface Message {
  id: string; // FirestoreドキュメントID
  senderId: string;
  senderName: string; // 送信者の表示名 (例: メールアドレスのローカルパート)
  text: string;
  createdAt: Timestamp; // FirestoreのTimestamp型
}

export default function ChatScreen() {
  const route = useRoute();
  // MyBookingsScreenから渡されるパラメータの型を定義
  const { chatId, skillTitle, instructorId, studentId, participantId, participantName } = route.params as {
    chatId: string;
    skillTitle: string;
    instructorId: string;
    studentId: string;
    participantId: string;
    participantName: string;
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any | null>(null); // Firebase User オブジェクト
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null); // FlatListの参照

  useEffect(() => {
    // 現在のユーザー情報を取得
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        // ユーザーがログインしていない場合、エラー処理またはログイン画面へのリダイレクト
        Alert.alert("エラー", "チャット機能を利用するにはログインが必要です。");
      }
    });

    // チャットメッセージのリアルタイムリスナーを設定
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc')); // 時刻で昇順ソート

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach(doc => {
        fetchedMessages.push({
          id: doc.id,
          ...doc.data() as Omit<Message, 'id'>
        });
      });
      setMessages(fetchedMessages);
      setIsLoading(false);
      // 新しいメッセージが追加されたら最下部にスクロール
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, (error) => {
      console.error("チャットメッセージの取得エラー:", error);
      Alert.alert("エラー", "チャットメッセージの読み込みに失敗しました。");
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMessages();
    };
  }, [chatId]); // chatIdが変更されたら再実行

  // メッセージ送信処理
  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !currentUser) {
      return; // 空のメッセージまたは未ログインでは送信しない
    }

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: currentUser.email ? currentUser.email.split('@')[0] : '匿名ユーザー', // メールアドレスのローカルパートを名前として使用
        text: newMessage,
        createdAt: serverTimestamp(), // Firestoreのサーバータイムスタンプ
      });
      setNewMessage(''); // 送信後、入力フィールドをクリア
      // メッセージ送信後、自動的に最下部にスクロール
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    } catch (error) {
      console.error("メッセージ送信エラー:", error);
      Alert.alert("エラー", "メッセージの送信に失敗しました。");
    }
  };

  // 各メッセージアイテムのレンダリング
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === (currentUser ? currentUser.uid : '');
    const messageTime = item.createdAt instanceof Timestamp ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '送信中...';

    return (
      <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble]}>
        <Text style={styles.messageSender}>{isMyMessage ? 'あなた' : item.senderName}</Text>
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.messageTime}>{messageTime}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>チャット履歴を読み込み中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>チャット</Text>
        <Text style={styles.skillTitle}>{skillTitle}</Text>
        <Text style={styles.participantName}>チャット相手: {participantName}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatMessagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} // コンテンツサイズ変更時にスクロール
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inputContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20} // iOSでの調整
      >
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="メッセージを入力..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendButtonText}>送信</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 15,
    backgroundColor: '#00796B',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'center',
  },
  skillTitle: {
    fontSize: 18,
    color: '#E0F2F7',
    textAlign: 'center',
    marginBottom: 3,
  },
  participantName: {
    fontSize: 16,
    color: '#E0F2F7',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#555',
  },
  chatMessagesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessageBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6', // 送信者側の色
  },
  otherMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF', // 受信者側の色
  },
  messageSender: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120, // メッセージが長くなった場合に備えて高さを制限
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 10,
    backgroundColor: '#F0F0F0',
  },
  sendButton: {
    backgroundColor: '#00796B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
