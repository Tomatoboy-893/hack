// ChatScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { auth, db, storage } from './firebaseConfig'; // Firebase Storageをインポート
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Storageの関数をインポート
import * as DocumentPicker from 'expo-document-picker'; // Expo DocumentPickerをインポート (ネイティブ用)
import * as ImagePicker from 'expo-image-picker'; // Expo ImagePickerをインポート (ネイティブ用)


// メッセージデータの型定義を拡張
interface Message {
  id: string; // FirestoreドキュメントID
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'document'; // メッセージタイプを追加
  text?: string; // テキストメッセージの場合
  imageUrl?: string; // 画像メッセージの場合
  fileUrl?: string; // ファイルメッセージの場合
  fileName?: string; // ファイルメッセージの場合 (ファイル名)
  createdAt: Timestamp;
}

export default function ChatScreen() {
  const route = useRoute();
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
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false); // アップロード中かどうか
  const [uploadProgress, setUploadProgress] = useState(0); // アップロード進捗
  const flatListRef = useRef<FlatList>(null);

  // Web用のファイル入力参照
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert("エラー", "チャット機能を利用するにはログインが必要です。");
      }
    });

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

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
  }, [chatId]);

  // メッセージ送信処理
  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !currentUser) {
      return;
    }

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: currentUser.email ? currentUser.email.split('@')[0] : '匿名ユーザー',
        type: 'text', // テキストメッセージとして保存
        text: newMessage,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    } catch (error) {
      console.error("メッセージ送信エラー:", error);
      Alert.alert("エラー", "メッセージの送信に失敗しました。");
    }
  };

  // ビデオ通話を開始する
  const handleStartVideoCall = () => {
    const videoCallUrl = `https://meet.google.com/new`; // または `https://zoom.us/start/videomeeting`
    Linking.openURL(videoCallUrl).catch(err => {
      console.error("ビデオ通話を開けませんでした:", err);
      Alert.alert("エラー", "ビデオ通話アプリを開けませんでした。ブラウザで直接アクセスしてください。\n" + videoCallUrl);
    });
  };

  // ファイルアップロード処理 (画像/ドキュメント共通)
  const uploadFile = async (uri: string, fileType: 'image' | 'document', fileName: string) => {
    if (!currentUser) {
      Alert.alert("エラー", "ファイルを送信するにはログインが必要です。");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const storageRefPath = `chat_files/${chatId}/${fileType}s/${fileName}`;
    const fileRef = ref(storage, storageRefPath);

    try {
      // Fetch the file as a Blob for upload
      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(fileRef, blob);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("ファイルのアップロードエラー:", error);
          Alert.alert("エラー", "ファイルのアップロードに失敗しました。");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const messagesRef = collection(db, 'chats', chatId, 'messages');

          await addDoc(messagesRef, {
            senderId: currentUser.uid,
            senderName: currentUser.email ? currentUser.email.split('@')[0] : '匿名ユーザー',
            type: fileType,
            ...(fileType === 'image' && { imageUrl: downloadURL }),
            ...(fileType === 'document' && { fileUrl: downloadURL, fileName: fileName }),
            createdAt: serverTimestamp(),
          });
          setUploading(false);
          setUploadProgress(0);
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }
      );
    } catch (error) {
      console.error("ファイル選択またはアップロードの準備エラー:", error);
      Alert.alert("エラー", "ファイルの選択またはアップロードに失敗しました。");
      setUploading(false);
    }
  };

  // 画像選択ハンドラ
  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      // Webの場合、隠しinput要素をクリック
      imageInputRef.current?.click();
    } else {
      // ネイティブの場合、expo-image-pickerを使用
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('パーミッションが必要です', '画像を選択するにはメディアライブラリのパーミッションが必要です。');
        return;
      }
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'image.jpg';
        await uploadFile(asset.uri, 'image', fileName);
      }
    }
  };

  // ファイル選択ハンドラ
  const handlePickFile = async () => {
    if (Platform.OS === 'web') {
      // Webの場合、隠しinput要素をクリック
      fileInputRef.current?.click();
    } else {
      // ネイティブの場合、expo-document-pickerを使用
      let result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // すべてのファイルタイプを許可
        copyToCacheDirectory: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.name;
        await uploadFile(asset.uri, 'document', fileName);
      }
    }
  };

  // Web用のファイル入力変更ハンドラ
  const handleWebFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const uri = URL.createObjectURL(file); // Blob URLを作成
      uploadFile(uri, type, file.name);
    }
  };


  // 各メッセージアイテムのレンダリング
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === (currentUser ? currentUser.uid : '');
    const messageTime = item.createdAt instanceof Timestamp ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '送信中...';

    return (
      <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble]}>
        <Text style={styles.messageSender}>{isMyMessage ? 'あなた' : item.senderName}</Text>
        {item.type === 'text' && item.text && (
          <Text style={styles.messageText}>{item.text}</Text>
        )}
        {item.type === 'image' && item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.chatImage} />
        )}
        {item.type === 'document' && item.fileUrl && item.fileName && (
          <TouchableOpacity onPress={() => Linking.openURL(item.fileUrl!)}>
            <Text style={styles.fileLink}>📄 {item.fileName}</Text>
          </TouchableOpacity>
        )}
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {uploading && (
        <View style={styles.uploadProgressContainer}>
          <Text style={styles.uploadProgressText}>ファイルアップロード中: {uploadProgress.toFixed(0)}%</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inputContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Web用の隠しファイル入力要素 */}
        {Platform.OS === 'web' && (
          <>
            <input
              type="file"
              ref={imageInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={(e) => handleWebFileChange(e, 'image')}
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleWebFileChange(e, 'document')}
            />
          </>
        )}

        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="メッセージを入力..."
          placeholderTextColor="#999"
          multiline
          editable={!uploading} // アップロード中は入力不可
        />
        <TouchableOpacity style={styles.actionButton} onPress={handleStartVideoCall} disabled={uploading}>
          <Text style={styles.actionButtonText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handlePickImage} disabled={uploading}>
          <Text style={styles.actionButtonText}>🖼️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handlePickFile} disabled={uploading}>
          <Text style={styles.actionButtonText}>📎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={uploading || newMessage.trim() === ''}>
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
  chatImage: {
    width: 200, // 適宜調整
    height: 150, // 適宜調整
    borderRadius: 10,
    marginTop: 5,
  },
  fileLink: {
    fontSize: 16,
    color: '#00796B',
    textDecorationLine: 'underline',
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
    maxHeight: 120,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 5, // ボタンとの間隔
    backgroundColor: '#F0F0F0',
  },
  actionButton: { // 画像やファイル送信ボタンのスタイル
    backgroundColor: '#00BCD4',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sendButton: {
    backgroundColor: '#00796B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
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
  uploadProgressContainer: {
    padding: 10,
    backgroundColor: '#E0F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#B3E5FC',
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#00796B',
    marginBottom: 5,
  },
  progressBarBackground: {
    width: '90%',
    height: 8,
    backgroundColor: '#B3E5FC',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00796B',
    borderRadius: 4,
  },
});
