// InstructorAvailabilityScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator, FlatList, TouchableOpacity, Platform, TextInput, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth, db } from './firebaseConfig'; 
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'; 
import { MaterialIcons } from '@expo/vector-icons'; 
import { useRoute } from '@react-navigation/native'; 

interface AvailabilitySlot {
  id: string; 
  startTime: string; 
  endTime: string; 
  status: 'available' | 'booked'; 
  createdAt: string;
}

export default function InstructorAvailabilityScreen() {
  const route = useRoute(); 
  const { skillId, skillTitle } = route.params as { skillId: string; skillTitle: string }; 

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [manualDateInput, setManualDateInput] = useState(''); 
  const [manualStartTimeInput, setManualStartTimeInput] = useState(''); 
  const [manualEndTimeInput, setManualEndTimeInput] = useState(''); 

  const [date, setDate] = useState(new Date()); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startTime, setStartTime] = useState(new Date()); 
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [endTime, setEndTime] = useState(new Date()); 
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingSlot, setIsAddingSlot] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !skillId) { 
      Alert.alert("エラー", "ユーザー情報またはスキル情報がありません。");
      setIsLoading(false);
      return;
    }
    setCurrentUserId(user.uid);

    const now = new Date();
    setDate(now);
    setStartTime(now);
    setEndTime(now);
    if (Platform.OS === 'web') {
      setManualDateInput(now.toISOString().slice(0, 10)); 
      setManualStartTimeInput(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })); 
      setManualEndTimeInput(new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })); 
    }

    const availabilityRef = collection(db, 'skills', skillId, 'availability');
    const q = query(availabilityRef, orderBy('startTime', 'asc')); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slots: AvailabilitySlot[] = [];
      snapshot.forEach(doc => {
        slots.push({ id: doc.id, ...doc.data() as Omit<AvailabilitySlot, 'id'> });
      });
      setAvailabilitySlots(slots);
      setIsLoading(false);
    }, (error) => {
      console.error("開催日程の取得エラー:", error);
      Alert.alert("エラー", "開催日程の読み込みに失敗しました。");
      setIsLoading(false);
    });

    return () => unsubscribe(); 
  }, [skillId]); 

  const onDateChange = (event: any, selectedDate: Date | undefined) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios'); 
    setDate(currentDate);
  };

  const onStartTimeChange = (event: any, selectedTime: Date | undefined) => {
    const currentTime = selectedTime || startTime;
    setShowStartTimePicker(Platform.OS === 'ios'); 
    setStartTime(currentTime);
  };

  const onEndTimeChange = (event: any, selectedTime: Date | undefined) => {
    const currentTime = selectedTime || endTime;
    setShowEndTimePicker(Platform.OS === 'ios'); 
    setEndTime(currentTime);
  };

  const handleAddSlot = async () => {
    if (!currentUserId || !skillId) { 
      Alert.alert("エラー", "ユーザー情報またはスキル情報がありません。");
      return;
    }

    let startDateTime: Date;
    let endDateTime: Date;

    if (Platform.OS === 'web') {
      const fullStartDateString = `${manualDateInput}T${manualStartTimeInput}:00`; 
      const fullEndDateString = `${manualDateInput}T${manualEndTimeInput}:00`;
      
      startDateTime = new Date(fullStartDateString);
      endDateTime = new Date(fullEndDateString);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        Alert.alert("入力エラー", "有効な日付と時刻の形式 (YYYY-MM-DD HH:MM) で入力してください。");
        return;
      }

    } else {
      startDateTime = new Date(
        date.getFullYear(), date.getMonth(), date.getDate(),
        startTime.getHours(), startTime.getMinutes()
      );
      endDateTime = new Date(
        date.getFullYear(), date.getMonth(), date.getDate(),
        endTime.getHours(), endTime.getMinutes()
      );
    }

    if (startDateTime >= endDateTime) {
      Alert.alert("入力エラー", "開始時刻は終了時刻より前である必要があります。");
      return;
    }
    if (startDateTime < new Date(new Date().getTime() - 60 * 1000)) { 
      Alert.alert("入力エラー", "過去の時刻は追加できません。");
      return;
    }

    setIsAddingSlot(true); 

    try {
      const availabilityRef = collection(db, 'skills', skillId, 'availability');
      await addDoc(availabilityRef, {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'available', 
        createdAt: new Date().toISOString(),
        instructorId: currentUserId, 
      });
      Alert.alert("成功", "開催日程が追加されました。");
      
      if (Platform.OS === 'web') {
        const now = new Date();
        setManualDateInput(now.toISOString().slice(0, 10));
        setManualStartTimeInput(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
        setManualEndTimeInput(new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
      }
    } catch (error) {
      console.error("開催日程追加エラー:", error);
      if (error.code) {
        console.error("Firebase Error Code:", error.code);
        console.error("Firebase Error Message:", error.message);
      }
      Alert.alert("エラー", "開催日程の追加に失敗しました。");
    } finally {
      setIsAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!currentUserId || !skillId) { 
      Alert.alert("エラー", "ユーザー情報またはスキル情報がありません。");
      return;
    }
    Alert.alert(
      "確認",
      "この開催日程を削除しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          onPress: async () => {
            try {
              const slotRef = doc(db, 'skills', skillId, 'availability', slotId);
              await deleteDoc(slotRef);
              Alert.alert("成功", "開催日程が削除されました。");
            } catch (error) {
              console.error("開催日程削除エラー:", error);
              Alert.alert("エラー", "開催日程の削除に失敗しました。");
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
        <Text style={styles.loadingText}>開催日程を読み込み中...</Text>
      </View>
    );
  }

  // 利用可能なスロットアイテムのレンダリング
  const renderSlotItem = ({ item }: { item: AvailabilitySlot }) => {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    return (
      <View style={styles.slotItem}>
        <Text style={styles.slotText}>
          {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text><Text style={[styles.slotStatus, item.status === 'available' ? styles.statusAvailable : styles.statusBooked]}>
          {item.status === 'available' ? '利用可能' : '予約済み'}
        </Text><TouchableOpacity onPress={() => handleDeleteSlot(item.id)} style={styles.deleteButton}>
          <MaterialIcons name="delete" size={24} color="#FF6347" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>「{skillTitle}」の開催日程</Text> 
        <Text style={styles.subtitle}>このスキル教えられる日時を追加・管理します</Text>

        {/* 日付選択 */}
        <Text style={styles.label}>日付を選択:</Text>
        {Platform.OS === 'web' ? (
          <TextInput
            style={styles.input}
            placeholder="日付 (YYYY-MM-DD)"
            value={manualDateInput}
            onChangeText={setManualDateInput}
            keyboardType="numeric"
            maxLength={10} 
            placeholderTextColor="#888"
          />
        ) : (
          <>
            <Button onPress={() => setShowDatePicker(true)} title="日付を選ぶ" color="#00796B" />
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}
          </>
        )}
        <Text style={styles.selectedDateTime}>
          選択した日付: {Platform.OS === 'web' ? manualDateInput : date.toLocaleDateString()}
        </Text>

        {/* 開始時刻選択 */}
        <Text style={styles.label}>開始時刻を選択:</Text>
        {Platform.OS === 'web' ? (
          <TextInput
            style={styles.input}
            placeholder="開始時刻 (HH:MM)"
            value={manualStartTimeInput}
            onChangeText={setManualStartTimeInput}
            keyboardType="numeric"
            maxLength={5} 
            placeholderTextColor="#888"
          />
        ) : (
          <>
            <Button onPress={() => setShowStartTimePicker(true)} title="開始時刻を選ぶ" color="#00796B" />
            {showStartTimePicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={onStartTimeChange}
              />
            )}
          </>
        )}
        <Text style={styles.selectedDateTime}>
          選択した時刻: {Platform.OS === 'web' ? manualStartTimeInput : startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        {/* 終了時刻選択 */}
        <Text style={styles.label}>終了時刻を選択:</Text>
        {Platform.OS === 'web' ? (
          <TextInput
            style={styles.input}
            placeholder="終了時刻 (HH:MM)"
            value={manualEndTimeInput}
            onChangeText={setManualEndTimeInput}
            keyboardType="numeric"
            maxLength={5} 
            placeholderTextColor="#888"
          />
        ) : (
          <>
            <Button onPress={() => setShowEndTimePicker(true)} title="終了時刻を選ぶ" color="#00796B" />
            {showEndTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={onEndTimeChange}
              />
            )}
          </>
        )}
        <Text style={styles.selectedDateTime}>
          選択した時刻: {Platform.OS === 'web' ? manualEndTimeInput : endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleAddSlot} disabled={isAddingSlot}>
          <Text style={styles.buttonText}>この日程を追加</Text>
        </TouchableOpacity>
        {isAddingSlot && <ActivityIndicator size="small" color="#2196F3" style={{ marginTop: 10 }} />}

        <Text style={styles.sectionTitle}>追加済みの開催日程</Text>
        {availabilitySlots.length === 0 ? (
          <Text style={styles.emptyText}>まだ開催日程が登録されていません。</Text>
        ) : (
          <FlatList
            data={availabilitySlots}
            renderItem={renderSlotItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            scrollEnabled={false} 
          />
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
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#00796B',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
    color: '#333',
  },
  selectedDateTime: {
    fontSize: 16,
    marginTop: 5,
    marginBottom: 15,
    color: '#00796B',
    fontWeight: 'bold',
  },
  webPickerNote: { 
    fontSize: 12,
    color: '#888',
    marginTop: -10,
    marginBottom: 5,
    textAlign: 'center',
  },
  input: { 
    width: '80%', 
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#B2EBF2',
    borderRadius: 10, 
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  button: { // 共通ボタン
    width: '80%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2196F3',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 15,
    color: '#00796B',
  },
  listContent: {
    width: '100%',
    alignItems: 'center', 
    paddingBottom: 20,
  },
  slotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    width: '90%', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  slotText: {
    fontSize: 16,
    color: '#333',
    flex: 1, 
  },
  slotStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    marginLeft: 10,
  },
  statusAvailable: {
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
  },
  statusBooked: {
    backgroundColor: '#FFEBEE',
    color: '#F44336',
  },
  deleteButton: {
    marginLeft: 15,
    padding: 5,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#555',
  },
});
