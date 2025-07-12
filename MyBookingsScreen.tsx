// MyBookingsScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { auth, db } from './firebaseConfig'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore'; // deleteDocもインポート
import { useNavigation, NavigationProp } from '@react-navigation/native';

// React Navigationのルートとパラメータの型定義
type RootStackParamList = {
  Login: undefined;
  Chat: {
    chatId: string;
    skillTitle: string;
    instructorId: string;
    studentId: string;
    participantId: string;
    participantName: string;
  };
  // 他のスクリーンがあればここに追加
};

// 予約データの型定義
interface Booking {
  id: string; // ドキュメントID
  skillId: string;
  skillTitle: string;
  skillPrice: number;
  instructorId: string;
  instructorName: string;
  studentId: string;
  studentEmail: string;
  bookingDateTime: string; // ISO文字列
  bookingEndTime: string; // ISO文字列
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; // 予約ステータス
  createdAt: string;
}

export default function MyBookingsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState<boolean>(false); // 処理中の状態（削除・更新）

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("エラー", "ログインしていません。");
      setIsLoading(false);
      navigation.navigate('Login'); 
      return;
    }
    setCurrentUserId(user.uid);

    let allBookings: Booking[] = [];
    let studentUnsubscribe: () => void;
    let instructorUnsubscribe: () => void;

    // 予約者としての予約を監視
    const bookingsCollectionRef = collection(db, 'bookings');
    const qStudent = query(
      bookingsCollectionRef,
      where('studentId', '==', user.uid),
      orderBy('bookingDateTime', 'asc')
    );

    studentUnsubscribe = onSnapshot(qStudent, (snapshot) => {
      const studentBookings: Booking[] = [];
      snapshot.forEach((doc) => {
        studentBookings.push({ id: doc.id, ...doc.data() as Omit<Booking, 'id'> });
      });
      // 講師としての予約と結合 (重複を排除)
      allBookings = [...studentBookings, ...allBookings.filter(b => b.studentId !== user.uid)];
      setMyBookings(allBookings.sort((a, b) => new Date(a.bookingDateTime).getTime() - new Date(b.bookingDateTime).getTime()));
      setIsLoading(false);
    }, (error) => {
      console.error("学生予約取得エラー:", error); 
      Alert.alert("エラー", "予約リストの読み込みに失敗しました。");
      setIsLoading(false);
    });

    // 講師としての予約を監視
    const qInstructor = query(
      bookingsCollectionRef,
      where('instructorId', '==', user.uid),
      orderBy('bookingDateTime', 'asc')
    );

    instructorUnsubscribe = onSnapshot(qInstructor, (snapshot) => {
      const instructorBookings: Booking[] = [];
      snapshot.forEach((doc) => {
        instructorBookings.push({ id: doc.id, ...doc.data() as Omit<Booking, 'id'> });
      });
      // 学生としての予約と結合 (重複を排除)
      allBookings = [...instructorBookings, ...allBookings.filter(b => b.instructorId !== user.uid)];
      setMyBookings(allBookings.sort((a, b) => new Date(a.bookingDateTime).getTime() - new Date(b.bookingDateTime).getTime()));
      setIsLoading(false);
    }, (error) => {
      console.error("講師予約取得エラー:", error); 
      Alert.alert("エラー", "予約リストの読み込みに失敗しました。");
      setIsLoading(false);
    });

    return () => {
      studentUnsubscribe();
      instructorUnsubscribe();
    }; 
  }, []);

  // 予約を完了し、関連するチャット履歴を削除する関数を再構築
  const handleCompleteBooking = async (bookingId: string) => {
    Alert.alert(
      "予約を完了する",
      "この予約を完了済みにし、チャット履歴を削除しますか？\nこの操作は元に戻せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "完了する",
          onPress: async () => {
            setIsProcessingBooking(true); // 処理中フラグを立てる
            try {
              const batch = writeBatch(db); // バッチ処理を開始

              // 1. チャットメッセージを削除
              const messagesRef = collection(db, 'chats', bookingId, 'messages');
              const messagesSnapshot = await getDocs(messagesRef);
              if (!messagesSnapshot.empty) {
                console.log(`チャットID ${bookingId} のメッセージ ${messagesSnapshot.size} 件を削除中...`);
                messagesSnapshot.forEach(msgDoc => {
                  batch.delete(msgDoc.ref);
                });
              } else {
                console.log(`チャットID ${bookingId} にメッセージはありませんでした。`);
              }

              // 2. チャットドキュメント自体を削除
              const chatDocRef = doc(db, 'chats', bookingId);
              // チャットドキュメントが存在するか確認してから削除を試みる
              const chatDocSnapshot = await getDocs(query(collection(db, 'chats'), where('__name__', '==', bookingId)));
              if (!chatDocSnapshot.empty) {
                console.log(`チャットドキュメント ${bookingId} を削除中...`);
                batch.delete(chatDocRef);
              } else {
                console.log(`チャットドキュメント ${bookingId} は存在しませんでした。`);
              }

              // 3. 予約ステータスを'completed'に更新
              const bookingRef = doc(db, 'bookings', bookingId);
              console.log(`予約 ${bookingId} のステータスを 'completed' に更新中...`);
              batch.update(bookingRef, { status: 'completed' });

              // バッチをコミット
              await batch.commit();
              console.log("Firestoreバッチ処理が正常にコミットされました。");

              Alert.alert("成功", "予約が完了済みになり、チャット履歴が削除されました。");
            } catch (error: any) {
              console.error("予約完了とチャット削除エラー:", error);
              // Firebaseエラーコードに基づいてより具体的なメッセージを表示
              if (error.code) {
                Alert.alert("エラー", `操作に失敗しました: ${error.code}\n権限を確認してください。`);
              } else {
                Alert.alert("エラー", `予約の完了とチャット履歴の削除に失敗しました。\n詳細: ${error.message || '不明なエラー'}`);
              }
            } finally {
              setIsProcessingBooking(false); // 処理中フラグを解除
            }
          },
        },
      ],
      { cancelable: false }
    );
  };


  // チャットを開始する関数
  const handleStartChat = (booking: Booking) => {
    // ChatScreenに予約情報と、チャット相手の情報を渡す
    const participantId = booking.instructorId === currentUserId ? booking.studentId : booking.instructorId;
    const participantName = booking.instructorId === currentUserId ? booking.studentEmail.split('@')[0] : booking.instructorName; // 相手の名前を仮で設定

    navigation.navigate('Chat', { 
      chatId: booking.id, // 予約IDをチャットIDとして利用
      skillTitle: booking.skillTitle,
      instructorId: booking.instructorId,
      studentId: booking.studentId,
      participantId: participantId,
      participantName: participantName,
    });
  };


  if (isLoading || isProcessingBooking) { // 処理中の状態も考慮
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>
          {isProcessingBooking ? '処理中...' : '予約を読み込み中...'}
        </Text>
      </View>
    );
  }

  // 予約ステータスに基づいて適切なスタイルを返すヘルパー関数
  const getStatusStyle = (status: Booking['status']) => {
    // 'pending'の場合も'confirmed'のスタイルを適用
    if (status === 'pending' || status === 'confirmed') {
      return styles.statusConfirmed;
    }
    switch (status) {
      case 'completed':
        return styles.statusCompleted;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return {}; 
    }
  };

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const bookingStart = new Date(item.bookingDateTime);
    const bookingEnd = new Date(item.bookingEndTime);
    const now = new Date(); // 現在時刻を取得

    // チャットボタンを表示する条件: 予約が保留中または確定済み
    const showChatButton = item.status === 'pending' || item.status === 'confirmed';

    // 講義が終了し、完了できる条件
    // 予約が確定済みまたは保留中で、かつ終了時刻が現在時刻を過ぎている場合
    const canBeCompleted = (item.status === 'confirmed' || item.status === 'pending') && now.getTime() > bookingEnd.getTime();

    // 表示用のステータス文字列を決定
    let displayStatus = '';
    if (item.status === 'pending' || item.status === 'confirmed') {
      displayStatus = '確定済み'; // 'pending'も'確定済み'として表示
    } else if (item.status === 'completed') {
      displayStatus = '完了';
    } else if (item.status === 'cancelled') {
      displayStatus = 'キャンセル済み';
    } else {
      displayStatus = item.status; // その他の未知のステータス
    }

    return (
      <View style={styles.bookingItem}>
        <Text style={styles.bookingTitle}>{item.skillTitle}</Text>
        {/* 講師名または受講者名を表示 */}
        <Text style={styles.bookingRole}>
          {item.instructorId === currentUserId ? `受講者: ${item.studentEmail}` : `講師: ${item.instructorName}`}
        </Text>
        <Text style={styles.bookingDateTime}>
          日時: {bookingStart.toLocaleDateString()} {bookingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {bookingEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={[styles.bookingStatus, getStatusStyle(item.status)]}>
          ステータス: {displayStatus}
        </Text>

        {/* チャットボタン */}
        {showChatButton && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.chatButton]} 
            onPress={() => handleStartChat(item)}
          >
            <Text style={styles.actionButtonText}>チャットを開始</Text>
          </TouchableOpacity>
        )}

        {/* 完了ボタン */}
        {canBeCompleted && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleCompleteBooking(item.id)}
            disabled={isProcessingBooking} // 処理中はボタンを無効化
          >
            <Text style={styles.actionButtonText}>完了する</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>自分の予約</Text>
      {myBookings.length === 0 ? (
        <Text style={styles.emptyText}>まだ予約がありません。</Text>
      ) : (
        <FlatList
          data={myBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F7',
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2F7',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#00796B',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  bookingItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#00796B',
  },
  bookingRole: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  bookingDateTime: {
    fontSize: 14,
    color: '#777',
    marginBottom: 10,
  },
  bookingStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignSelf: 'flex-start', 
  },
  statusPending: {
    backgroundColor: '#FFF3E0', 
    color: '#FF9800',
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E9', 
    color: '#4CAF50',
  },
  statusCompleted: {
    backgroundColor: '#CFD8DC', 
    color: '#455A64',
  },
  statusCancelled: {
    backgroundColor: '#FFEBEE', 
    color: '#F44336',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#555',
  },
  actionButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    width: '100%',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1, 
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  confirmButton: {
    backgroundColor: '#4CAF50', 
  },
  cancelButton: {
    backgroundColor: '#F44336', 
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  chatButton: {
    backgroundColor: '#00BCD4',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    width: '100%',
  },
  completeButton: {
    backgroundColor: '#607D8B',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    width: '100%',
  },
});
