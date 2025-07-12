// MySkillsManagementScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Alert, Button, TouchableOpacity } from 'react-native';
import { auth, db } from './firebaseConfig'; 
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; // Firestoreの関数をインポート
import { useNavigation } from '@react-navigation/native';

interface Skill {
  id: string; // FirestoreのドキュメントID
  title: string;
  description: string;
  category: string;
  points: number;
  instructorId: string;
  instructorName: string;
  duration: number;
}

export default function MySkillsManagementScreen() {
  const navigation = useNavigation();
  const [mySkills, setMySkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("エラー", "ログインしていません。");
      setIsLoading(false);
      navigation.navigate('Login' as never); // ログイン画面に戻す
      return;
    }
    setCurrentUserId(user.uid);

    // 自分のスキルのみをリアルタイムで取得
    const skillsCollectionRef = collection(db, 'skills');
    const q = query(
      skillsCollectionRef, 
      where('instructorId', '==', user.uid), // 自分のUIDと一致するスキルのみ
      orderBy('createdAt', 'desc') // 新しいものから表示
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSkills: Skill[] = [];
      snapshot.forEach((doc) => {
        fetchedSkills.push({ id: doc.id, ...doc.data() as Omit<Skill, 'id'> });
      });
      setMySkills(fetchedSkills);
      setIsLoading(false);
    }, (error) => {
      console.error("自分のスキル取得エラー:", error);
      Alert.alert("エラー", "自分のスキルの読み込みに失敗しました。");
      setIsLoading(false);
    });

    return () => unsubscribe(); // リスナーのクリーンアップ
  }, []);

  // 開催日程管理画面へ遷移するハンドラー
  const handleManageAvailability = (skillId: string, skillTitle: string) => {
    navigation.navigate('InstructorAvailability', { skillId, skillTitle }); // skillIdとskillTitleを渡す
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>自分のスキルを読み込み中...</Text>
      </View>
    );
  }

  const renderMySkillItem = ({ item }: { item: Skill }) => (
    <View style={styles.skillItem}>
      <Text style={styles.skillTitle}>{item.title}</Text>
      <Text style={styles.skillDescription}>{item.description}</Text>
      <Text style={styles.skillDetails}>カテゴリ: {item.category} | ポイント: {item.points}pt | 時間: {item.duration}分</Text>
      <TouchableOpacity 
        style={styles.manageButton}
        onPress={() => handleManageAvailability(item.id, item.title)}
      >
        <Text style={styles.manageButtonText}>開催日程を管理</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>自分が開催するスキル</Text>
      {mySkills.length === 0 ? (
        <Text style={styles.emptyText}>まだスキルを登録していません。</Text>
      ) : (
        <FlatList
          data={mySkills}
          renderItem={renderMySkillItem}
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
  skillItem: {
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
  skillTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#00796B',
  },
  skillDescription: {
    fontSize: 14,
    color: '#777',
    marginBottom: 10,
  },
  skillDetails: {
    fontSize: 12,
    color: '#999',
  },
  manageButton: {
    backgroundColor: '#673AB7', // 紫色のボタン
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#555',
  },
});
