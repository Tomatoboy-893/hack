// InstructorAvailabilityScreen.tsx - 修正版

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator, FlatList, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { auth, db } from './firebaseConfig'; 
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'; 
import { MaterialIcons } from '@expo/vector-icons'; 
import { useRoute } from '@react-navigation/native'; 

// Sliderの代わりにPickerを使用するか、別のライブラリを使用
// ここでは簡単なボタンベースの時間選択を実装
interface TimePickerProps {
  value: number;
  onValueChange: (value: number) => void;
  max: number;
  min: number;
  step: number;
  label: string;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onValueChange, max, min, step, label }) => {
  const increment = () => {
    if (value < max) {
      onValueChange(value + step);
    }
  };

  const decrement = () => {
    if (value > min) {
      onValueChange(value - step);
    }
  };

  return (
    <View style={styles.timePickerContainer}>
      <Text style={styles.timePickerLabel}>{label}</Text>
      <View style={styles.timePickerControlRow}>
        <TouchableOpacity onPress={decrement} style={styles.timePickerButton}>
          <Text style={styles.timePickerButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.timePickerValue}>{value}</Text>
        <TouchableOpacity onPress={increment} style={styles.timePickerButton}>
          <Text style={styles.timePickerButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface AvailabilitySlot {
  id: string; 
  startTime: string; 
  endTime: string; 
  status: 'available' | 'booked'; 
  createdAt: string;
}

// カレンダー用の日付データ
interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasAvailability: boolean;
}

export default function InstructorAvailabilityScreen() {
  const route = useRoute(); 
  const { skillId, skillTitle } = route.params as { skillId: string; skillTitle: string }; 

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // カレンダー関連の状態
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 時間選択用の状態
  const [startHour, setStartHour] = useState(12);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(13);
  const [endMinute, setEndMinute] = useState(0);

  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingSlot, setIsAddingSlot] = useState(false);

  // 日付を正確に比較するためのヘルパー関数
  const isSameDate = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // カレンダーの日付を生成
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    
    // 月の最初の日の曜日を取得
    const firstDayOfWeek = firstDay.getDay();
    
    // カレンダー表示用の開始日を計算
    const startDate = new Date(year, month, 1 - firstDayOfWeek);
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    // 42日分（6週間）の日付を生成
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      
      // その日に予定があるかチェック
      const hasAvailability = availabilitySlots.some(slot => {
        const slotDate = new Date(slot.startTime);
        return isSameDate(slotDate, currentDate);
      });
      
      days.push({
        date: currentDate,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: isSameDate(currentDate, today),
        isSelected: isSameDate(currentDate, selectedDate),
        hasAvailability
      });
    }
    
    setCalendarDays(days);
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !skillId) { 
      Alert.alert("エラー", "ユーザー情報またはスキル情報がありません。");
      setIsLoading(false);
      return;
    }
    setCurrentUserId(user.uid);

    const now = new Date();
    setSelectedDate(now);
    setCurrentMonth(now);

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

  useEffect(() => {
    generateCalendarDays();
  }, [currentMonth, availabilitySlots, selectedDate]);

  // カレンダーの日付選択
  const handleDateSelect = (selectedDate: Date) => {
    setSelectedDate(selectedDate);
  };

  // 月の切り替え
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // カレンダーの日付セルをレンダリング
  const renderCalendarDay = ({ item }: { item: CalendarDay }) => {
    return (
      <TouchableOpacity 
        style={[
          styles.calendarDay,
          !item.isCurrentMonth && styles.calendarDayInactive,
          item.isToday && styles.calendarDayToday,
          item.isSelected && styles.calendarDaySelected,
          item.hasAvailability && styles.calendarDayWithAvailability
        ]}
        onPress={() => handleDateSelect(item.date)}
      >
        <Text style={[
          styles.calendarDayText,
          !item.isCurrentMonth && styles.calendarDayTextInactive,
          item.isToday && styles.calendarDayTextToday,
          item.isSelected && styles.calendarDayTextSelected,
        ]}>
          {item.date.getDate()}
        </Text>
        {item.hasAvailability && <View style={styles.availabilityDot} />}
      </TouchableOpacity>
    );
  };

  // 時間をフォーマットする関数
  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // 期間を計算する関数
  const calculateDuration = (startHour: number, startMinute: number, endHour: number, endMinute: number): string => {
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    
    if (durationMinutes <= 0) {
      return "0分";
    }
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours}時間${minutes}分`;
    } else if (hours > 0) {
      return `${hours}時間`;
    } else {
      return `${minutes}分`;
    }
  };

  const handleAddSlot = async () => {
    if (!currentUserId || !skillId) { 
      Alert.alert("エラー", "ユーザー情報またはスキル情報がありません。");
      return;
    }

    const startDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      startHour,
      startMinute
    );

    const endDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      endHour,
      endMinute
    );

    if (startDateTime >= endDateTime) {
      Alert.alert("入力エラー", "開始時刻は終了時刻より前である必要があります。");
      return;
    }

    if (startDateTime < new Date()) { 
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
    } catch (error) {
      console.error("開催日程追加エラー:", error);
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
        <View style={styles.slotContent}>
          <Text style={styles.slotText}>
            {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={[styles.slotStatus, item.status === 'available' ? styles.statusAvailable : styles.statusBooked]}>
            {item.status === 'available' ? '利用可能' : '予約済み'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteSlot(item.id)} style={styles.deleteButton}>
          <MaterialIcons name="delete" size={24} color="#FF6347" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>スペース詳細に戻る</Text>

        {/* カレンダー表示 */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.calendarNavButton}>
              <Text style={styles.calendarNavButtonText}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
            </Text>
            <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.calendarNavButton}>
              <Text style={styles.calendarNavButtonText}>▶</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.weekDaysHeader}>
            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
              <Text key={index} style={[
                styles.weekDayText,
                index === 0 && styles.weekDayTextSunday,
                index === 6 && styles.weekDayTextSaturday
              ]}>
                {day}
              </Text>
            ))}
          </View>
          
          <FlatList
            data={calendarDays}
            renderItem={renderCalendarDay}
            keyExtractor={(item) => item.date.toISOString()}
            numColumns={7}
            scrollEnabled={false}
            style={styles.calendarGrid}
          />
        </View>

        {/* 時間選択UI */}
        <View style={styles.timeSelectionContainer}>
          <Text style={styles.timeLabel}>🕐 {formatTime(startHour, startMinute)} 〜 {formatTime(endHour, endMinute)}</Text>
          
          <View style={styles.timePickerSection}>
            <Text style={styles.timePickerSectionTitle}>開始時刻</Text>
            <View style={styles.timePickerRow}>
              <TimePicker
                value={startHour}
                onValueChange={setStartHour}
                min={0}
                max={23}
                step={1}
                label="時"
              />
              <TimePicker
                value={startMinute}
                onValueChange={setStartMinute}
                min={0}
                max={45}
                step={15}
                label="分"
              />
            </View>
          </View>

          <View style={styles.timePickerSection}>
            <Text style={styles.timePickerSectionTitle}>終了時刻</Text>
            <View style={styles.timePickerRow}>
              <TimePicker
                value={endHour}
                onValueChange={setEndHour}
                min={0}
                max={23}
                step={1}
                label="時"
              />
              <TimePicker
                value={endMinute}
                onValueChange={setEndMinute}
                min={0}
                max={45}
                step={15}
                label="分"
              />
            </View>
          </View>

          <Text style={styles.durationText}>
            期間: {calculateDuration(startHour, startMinute, endHour, endMinute)}
          </Text>
        </View>

        {/* セクション */}
        <View style={styles.planSection}>
          <Text style={styles.sectionTitle}></Text>
          
          <TouchableOpacity style={styles.addButton} onPress={handleAddSlot} disabled={isAddingSlot}>
            <Text style={styles.addButtonText}>
              {isAddingSlot ? '追加中...' : '開催日程を追加'}
            </Text>
          </TouchableOpacity>
          
          {isAddingSlot && <ActivityIndicator size="small" color="#2196F3" style={{ marginTop: 10 }} />}
        </View>

        {/* 既存の予定表示 */}
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
    backgroundColor: '#F5F5F5',
  },
  container: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  calendarNavButton: {
    padding: 10,
  },
  calendarNavButtonText: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weekDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    width: 35,
    fontWeight: 'bold',
  },
  weekDayTextSunday: {
    color: '#FF6B6B',
  },
  weekDayTextSaturday: {
    color: '#4ECDC4',
  },
  calendarGrid: {
    marginBottom: 0,
  },
  calendarDay: {
    width: '14.28%',
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 3,
  },
  calendarDayInactive: {
    opacity: 0.3,
  },
  calendarDayToday: {
    backgroundColor: '#E3F2FD',
    borderRadius: 17,
  },
  calendarDaySelected: {
    backgroundColor: '#2196F3',
    borderRadius: 17,
  },
  calendarDayWithAvailability: {
    backgroundColor: '#E8F5E9',
    borderRadius: 17,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#333',
  },
  calendarDayTextInactive: {
    color: '#CCC',
  },
  calendarDayTextToday: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  availabilityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    bottom: 2,
  },
  timeSelectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  timePickerSection: {
    marginBottom: 20,
  },
  timePickerSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timePickerContainer: {
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  timePickerControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePickerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  timePickerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timePickerValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  durationText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginTop: 10,
  },
  planSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButton: {
    backgroundColor: '#FFC107',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  listContent: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  slotContent: {
    flex: 1,
  },
  slotText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  slotStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    alignSelf: 'flex-start',
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
    padding: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 20,
  },
});
