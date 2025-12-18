// BookingScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, runTransaction } from 'firebase/firestore';

// React Navigationのルートとパラメータの型定義
type RootStackParamList = {
  Login: undefined;
};

// 開催日程スロットの型定義
interface AvailabilitySlot {
  id: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked';
  createdAt: string;
  instructorId: string;
}

export default function BookingScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { skillId, skillTitle, skillPoints, instructorId, instructorName } = route.params as {
    skillId: string;
    skillTitle: string;
    skillPoints: number;
    instructorId: string;
    instructorName: string;
  };

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [studentPoints, setStudentPoints] = useState<number | null>(null);

  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !skillId) return;

    const availabilityRef = collection(db, 'skills', skillId, 'availability');
    const q = query(availabilityRef, orderBy('startTime', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSlots: AvailabilitySlot[] = [];
      const now = new Date();
      snapshot.forEach(doc => {
        const slotData = doc.data() as Omit<AvailabilitySlot, 'id'>;
        const slotStartTime = new Date(slotData.startTime);
        if (slotData.status === 'available' && slotStartTime.getTime() > now.getTime()) {
          fetchedSlots.push({ id: doc.id, ...slotData });
        }
      });
      setAvailableSlots(fetchedSlots);
      setIsLoadingSlots(false);
    }, (error) => {
      console.error("開催日程取得エラー:", error);
      Alert.alert("エラー", "開催日程の読み込みに失敗しました。");
      setIsLoadingSlots(false);
    });

    return () => unsubscribe();
  }, [isAuthLoading, skillId]);

  useEffect(() => {
    if (!user) return;

    const studentRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(studentRef, (doc) => {
      if (doc.exists()) {
        setStudentPoints(doc.data().points ?? 0);
      } else {
        setStudentPoints(0);
      }
    }, (error) => {
      console.error("ユーザーのポイント取得エラー:", error);
      Alert.alert("エラー", "ご自身のポイント情報の読み込みに失敗しました。");
    });

    return () => unsubscribe();
  }, [user]);


  const handleBookNow = async () => {
    if (!user) {
      Alert.alert("エラー", "予約にはログインが必要です。");
      navigation.navigate('Login');
      return;
    }
    if (!selectedSlot) {
      Alert.alert("エラー", "予約する日時を選択してください。");
      return;
    }
    if (user.uid === instructorId) {
      Alert.alert("エラー", "自分のスキルを予約することはできません。");
      return;
    }

    setIsBooking(true);

    try {
      await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, 'users', user.uid);
        const instructorRef = doc(db, 'users', instructorId);
        const slotDocRef = doc(db, 'skills', skillId, 'availability', selectedSlot.id);
        
        const studentDoc = await transaction.get(studentRef);
        const instructorDoc = await transaction.get(instructorRef);
        const slotDoc = await transaction.get(slotDocRef);

        if (!studentDoc.exists() || !instructorDoc.exists()) {
          throw new Error("ユーザー情報が見つかりません。");
        }
        if (!slotDoc.exists() || slotDoc.data()?.status !== 'available') {
          throw new Error("この日程はすでに予約されているか、利用できません。");
        }

        const currentStudentPoints = studentDoc.data()?.points || 0;
        if (currentStudentPoints < skillPoints) {
          throw new Error(`ポイントが不足しています。(${skillPoints - currentStudentPoints}P不足)`);
        }
        const currentInstructorPoints = instructorDoc.data()?.points || 0;

        transaction.update(studentRef, { points: currentStudentPoints - skillPoints });
        transaction.update(instructorRef, { points: currentInstructorPoints + skillPoints });
        transaction.update(slotDocRef, { status: 'booked' });

        const newBookingRef = doc(collection(db, 'bookings'));
        transaction.set(newBookingRef, {
          skillId: skillId,
          skillTitle: skillTitle,
          skillPoints: skillPoints,
          instructorId: instructorId,
          instructorName: instructorName,
          studentId: user.uid,
          studentEmail: user.email,
          bookingDateTime: selectedSlot.startTime,
          bookingEndTime: selectedSlot.endTime,
          status: 'confirmed',
          availabilitySlotId: selectedSlot.id,
          createdAt: new Date().toISOString(),
        });
      });


      Alert.alert(
        '予約完了',
        `「${skillTitle}」の予約が完了しました！`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ],
        { cancelable: false }
      );

    } catch (error: any) {
      console.error("予約エラー:", error);

      let errorMessage = "予約中に予期せぬエラーが発生しました。";
      if (typeof error.message === 'string') {
          if (error.message.includes("ポイントが不足しています")) {
            errorMessage = error.message;
          } else if (error.message.includes("この日程はすでに予約されているか")) {
            errorMessage = error.message;
          } else if (error.message.includes("ユーザー情報が見つかりません")) {
            errorMessage = "予約に必要なユーザー情報が見つかりませんでした。";
          } else {
            // Firebaseのエラーコードをチェック
            switch (error.code) {
              case 'permission-denied':
                errorMessage = "予約を実行する権限がありません。アプリのセキュリティ設定を確認してください。";
                break;
              default:
                errorMessage = `予約中にエラーが発生しました。\n詳細: ${error.message}`;
                break;
            }
          }
      }
      Alert.alert("予約失敗", errorMessage);
    } finally {
      setIsBooking(false);
    }
  };

  const renderAvailabilitySlot = ({ item }: { item: AvailabilitySlot }) => {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    const isSelected = selectedSlot?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[styles.slotOption, isSelected ? styles.slotOptionSelected : {}]}
        onPress={() => setSelectedSlot(item)}
        disabled={item.status === 'booked'}
      >
        <Text style={styles.slotOptionText}>
          {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.status === 'booked' && (
          <Text style={styles.slotOptionStatus}> (予約済み)</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isAuthLoading || isLoadingSlots) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>
          {isAuthLoading ? '認証情報を確認中...' : '開催日程を読み込み中...'}
        </Text>
      </View>
    );
  }
  
  if (!user) {
      Alert.alert("セッション切れ", "再度ログインしてください。");
      navigation.navigate('Login');
      return (
        <View style={styles.loadingContainer}>
            <Text>ログイン画面に移動します...</Text>
        </View>
      );
  }


  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>スキル予約</Text>
        <Text style={styles.skillTitle}>{skillTitle}</Text>
        <Text style={styles.skillDetails}>講師: {instructorName} | 必要ポイント: {skillPoints}pt</Text>

        <View style={styles.pointBalanceContainer}>
          <Text style={styles.pointBalanceText}>
            あなたの所持ポイント: {studentPoints !== null ? `${studentPoints}pt` : '読み込み中...'}
          </Text>
        </View>

        <Text style={styles.label}>予約可能な日時を選択してください:</Text>
        {availableSlots.length === 0 ? (
          <Text style={styles.emptySlotsText}>この講師は現在、予約可能な日程を設定していません。</Text>
        ) : (
          <FlatList
            data={availableSlots}
            renderItem={renderAvailabilitySlot}
            keyExtractor={(item) => item.id}
            style={styles.slotList}
            contentContainerStyle={styles.slotListContent}
            scrollEnabled={false}
          />
        )}

        {selectedSlot && (
          <Text style={styles.selectedSlotText}>
            選択中の日時: {new Date(selectedSlot.startTime).toLocaleDateString()} {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            - {new Date(selectedSlot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.bookButton, (isBooking || !selectedSlot) && styles.disabledButton]}
          onPress={handleBookNow}
          disabled={isBooking || !selectedSlot}
        >
          <Text style={styles.bookButtonText}>このスキルを予約する</Text>
        </TouchableOpacity>

        {isBooking && (
          <ActivityIndicator size="large" color="#FF5722" style={styles.loadingIndicator} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#E0F2F7',
  },
  container: {
    backgroundColor: '#E0F2F7',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2F7',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#00796B',
  },
  skillTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
    textAlign: 'center',
  },
  skillDetails: {
    fontSize: 16,
    color: '#555',
    marginBottom: 15,
    textAlign: 'center',
  },
  pointBalanceContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#00796B'
  },
  pointBalanceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00796B',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
    color: '#333',
  },
  emptySlotsText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginTop: 20,
  },
  slotList: {
    width: '100%',
    maxHeight: 250,
    marginTop: 10,
  },
  slotListContent: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  slotOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slotOptionSelected: {
    borderColor: '#00796B',
    borderWidth: 2,
  },
  slotOptionText: {
    fontSize: 16,
    color: '#333',
  },
  slotOptionStatus: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: 'bold',
    marginTop: 5,
  },
  selectedSlotText: {
    fontSize: 16,
    marginTop: 20,
    fontWeight: 'bold',
    color: '#00796B',
    textAlign: 'center',
  },
  bookButton: {
    width: '80%',
    backgroundColor: '#FF5722',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
  },
});

