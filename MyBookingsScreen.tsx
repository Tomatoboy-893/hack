// MyBookingsScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { auth, db } from './firebaseConfig'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'; // updateDocを追加
import { useNavigation } from '@react-navigation/native';

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
  const navigation = useNavigation();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("エラー", "ログインしていません。");
      setIsLoading(false);
      navigation.navigate('Login' as never); 
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

  // ★追加: 予約ステータスを更新する関数
  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    Alert.alert(
      "予約ステータス変更",
      `この予約を「${newStatus === 'confirmed' ? '承認' : 'キャンセル'}」しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: newStatus === 'confirmed' ? "承認する" : "キャンセルする",
          onPress: async () => {
            try {
              const bookingRef = doc(db, 'bookings', bookingId);
              await updateDoc(bookingRef, { status: newStatus });
              Alert.alert("成功", `予約が「${newStatus === 'confirmed' ? '承認済み' : 'キャンセル済み'}」になりました。`);
            } catch (error) {
              console.error("予約ステータス更新エラー:", error);
              Alert.alert("エラー", "予約ステータスの更新に失敗しました。");
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>予約を読み込み中...</Text>
      </View>
    );
  }

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const bookingStart = new Date(item.bookingDateTime);
    const bookingEnd = new Date(item.bookingEndTime);
    const isInstructor = item.instructorId === currentUserId; 

    return (
      <View style={styles.bookingItem}>
        <Text style={styles.bookingTitle}>{item.skillTitle}</Text><Text style={styles.bookingRole}>
          {isInstructor ? `受講者: ${item.studentEmail}` : `講師: ${item.instructorName}`}
        </Text><Text style={styles.bookingDateTime}>
          日時: {bookingStart.toLocaleDateString()} {bookingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {bookingEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text><Text style={[styles.bookingStatus, styles[`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`]]}>
          ステータス: {
            item.status === 'pending' ? '保留中' :
            item.status === 'confirmed' ? '確定済み' :
            item.status === 'completed' ? '完了' :
            item.status === 'cancelled' ? 'キャンセル済み' : item.status
          }
        </Text>

        {/* ★追加: 講師の場合のみ、予約ステータス管理ボタンを表示 */}
        {isInstructor && item.status === 'pending' && (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.confirmButton]} 
              onPress={() => handleUpdateBookingStatus(item.id, 'confirmed')}
            >
              <Text style={styles.actionButtonText}>承認</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]} 
              onPress={() => handleUpdateBookingStatus(item.id, 'cancelled')}
            >
              <Text style={styles.actionButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#E0E0E0', 
    color: '#616161',
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
  // ★追加: アクションボタンのスタイル
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
    flex: 1, // 均等幅
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  confirmButton: {
    backgroundColor: '#4CAF50', // 緑色
  },
  cancelButton: {
    backgroundColor: '#F44336', // 赤色
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
