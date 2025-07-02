// BookingScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator, Platform, FlatList, TouchableOpacity, ScrollView } from 'react-native'; // ScrollViewを追加
import { useRoute, useNavigation } from '@react-navigation/native'; 
// DateTimePickerはもう使わないためインポートを削除またはコメントアウト
// import DateTimePicker from '@react-native-community/datetimepicker'; 
import { auth, db } from './firebaseConfig'; 
// Firestoreのデータ取得にonSnapshot, query, collection, orderBy, doc, updateDocを追加
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'; 

// 開催日程スロットの型定義
interface AvailabilitySlot {
  id: string; // ドキュメントID
  startTime: string; // ISO文字列
  endTime: string; // ISO文字列
  status: 'available' | 'booked'; // 予約状況
  createdAt: string;
  instructorId: string; // 講師IDも追加
}

export default function BookingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { skillId, skillTitle, skillPrice, instructorId, instructorName } = route.params as { 
    skillId: string; 
    skillTitle: string; 
    skillPrice: number; 
    instructorId: string; 
    instructorName: string; 
  }; 

  // 選択された開催日程スロットを管理するstateを追加
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]); // 講師の空き枠リスト
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null); // 選択された空き枠

  const [isLoading, setIsLoading] = useState(true); // スロット読み込み中のローディング
  const [isBooking, setIsBooking] = useState(false); // 予約中のローディング

  // 講師の利用可能なスロットをFirestoreから取得
  useEffect(() => {
    if (!skillId) { // skillIdがない場合はエラー
      Alert.alert("エラー", "スキル情報がありません。");
      setIsLoading(false);
      return;
    }

    // ★変更: 'skills/{skillId}/availability' からデータを取得
    const availabilityRef = collection(db, 'skills', skillId, 'availability');
    // 現在時刻より未来の「利用可能」なスロットのみを取得し、開始時刻でソート
    const q = query(
      availabilityRef, 
      orderBy('startTime', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSlots: AvailabilitySlot[] = [];
      const now = new Date();
      snapshot.forEach(doc => {
        const slotData = doc.data() as Omit<AvailabilitySlot, 'id'>;
        const slotStartTime = new Date(slotData.startTime);
        // ステータスが'available'で、かつ開始時刻が現在時刻より未来のスロットのみを対象
        if (slotData.status === 'available' && slotStartTime > now) {
          fetchedSlots.push({ id: doc.id, ...slotData });
        }
      });
      setAvailableSlots(fetchedSlots);
      setIsLoading(false);
    }, (error) => {
      console.error("開催日程取得エラー:", error);
      Alert.alert("エラー", "開催日程の読み込みに失敗しました。");
      setIsLoading(false);
    });

    return () => unsubscribe(); // リスナーのクリーンアップ
  }, [skillId]); // skillIdが変わったら再実行

  // 予約するボタンのハンドラー
  const handleBookNow = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("エラー", "ログインしていません。");
      navigation.navigate('Login' as never);
      return;
    }
    if (!selectedSlot) {
      Alert.alert("エラー", "予約する日時を選択してください。");
      return;
    }
    // 講師が自分自身を予約しようとしていないか確認
    if (user.uid === instructorId) {
      Alert.alert("エラー", "自分のスキルを予約することはできません。");
      return;
    }

    setIsBooking(true); // 予約中のローディング開始

    try {
      // 1. bookingsコレクションに予約データを作成
      const bookingsCollectionRef = collection(db, 'bookings');
      await addDoc(bookingsCollectionRef, {
        skillId: skillId,
        skillTitle: skillTitle,
        skillPrice: skillPrice,
        instructorId: instructorId,
        instructorName: instructorName,
        studentId: user.uid, // 予約者のUID
        studentEmail: user.email, // 予約者のメールアドレス
        bookingDateTime: selectedSlot.startTime, // 選択されたスロットの開始時刻を予約日時とする
        bookingEndTime: selectedSlot.endTime,   // 選択されたスロットの終了時刻を予約終了日時とする
        status: 'pending', // 初期ステータスは保留中
        availabilitySlotId: selectedSlot.id, // どの空き枠が予約されたか記録
        createdAt: new Date().toISOString(),
      });

      // 2. 予約された開催日程スロットのステータスを'booked'に更新
      // ★変更: skills/{skillId}/availability/{slotId} のステータスを更新
      const slotDocRef = doc(db, 'skills', skillId, 'availability', selectedSlot.id);
      await updateDoc(slotDocRef, {
        status: 'booked',
      });

      Alert.alert('予約完了', `「${skillTitle}」の予約が完了しました！\n選択日時: ${new Date(selectedSlot.startTime).toLocaleString()}`);
      navigation.goBack(); // スキル一覧画面に戻る
    } catch (error) {
      console.error("予約エラー:", error);
      Alert.alert("予約失敗", "予約中にエラーが発生しました。");
    } finally {
      setIsBooking(false); // ローディング終了
    }
  };

  // 開催日程スロットのレンダリング
  const renderAvailabilitySlot = ({ item }: { item: AvailabilitySlot }) => {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    const isSelected = selectedSlot?.id === item.id; // 選択中かどうか
    
    return (
      <TouchableOpacity 
        style={[styles.slotOption, isSelected ? styles.slotOptionSelected : {}]} 
        onPress={() => setSelectedSlot(item)}
        disabled={item.status === 'booked'} // 予約済みのスロットは選択不可
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>開催日程を読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}> {/* ScrollViewを追加 */}
      <View style={styles.container}>
        <Text style={styles.title}>スキル予約</Text>
        <Text style={styles.skillTitle}>スキル: {skillTitle}</Text>
        <Text style={styles.skillDetails}>講師: {instructorName} | 料金: ¥{skillPrice}</Text>

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
            scrollEnabled={false} // 親ScrollViewでスクロールするため、FlatList自体はスクロールさせない
          />
        )}

        {selectedSlot && (
          <Text style={styles.selectedSlotText}>
            選択中の日時: {new Date(selectedSlot.startTime).toLocaleDateString()} {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            - {new Date(selectedSlot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        <View style={styles.buttonContainer}>
          <Button 
            title="このスキルを予約する" 
            onPress={handleBookNow} 
            color="#FF5722" 
            disabled={isBooking || !selectedSlot} // 予約中またはスロット未選択の場合は無効
          />
        </View>

        {isBooking && (
          <ActivityIndicator size="large" color="#FF5722" style={styles.loadingIndicator} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { // ScrollViewのコンテンツ用スタイル
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#E0F2F7',
  },
  container: {
    // flex: 1, // ScrollViewの子なので不要
    backgroundColor: '#E0F2F7',
    alignItems: 'center',
    padding: 20,
    // width: '100%', // ScrollViewの子なので不要
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
    marginBottom: 20,
    color: '#00796B',
  },
  skillTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  skillDetails: {
    fontSize: 18,
    color: '#555',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
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
    maxHeight: 250, // リストの最大高さを設定してスクロール可能にする (FlatListはスクロールしないので、表示領域の制限になる)
    marginTop: 10,
  },
  slotListContent: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  slotOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
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
    borderColor: '#00796B', // 選択されたスロットの枠線色
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
  buttonContainer: {
    width: '80%',
    marginTop: 30,
  },
  loadingIndicator: {
    marginTop: 20,
  },
});
