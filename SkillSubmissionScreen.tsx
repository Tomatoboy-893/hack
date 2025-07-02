// SkillSubmissionScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, TouchableOpacity } from 'react-native'; // ★TouchableOpacityを追加
import { useNavigation } from '@react-navigation/native';
import { auth, db } from './firebaseConfig'; // Firebase AuthとFirestoreをインポート
import { collection, addDoc, doc, getDoc } from 'firebase/firestore'; // Firestoreの関数をインポート

export default function SkillSubmissionScreen() {
  const navigation = useNavigation();
  // スキル情報のstate
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState(''); // 価格は文字列で受け取り、数値に変換
  const [duration, setDuration] = useState(''); // 時間も文字列で受け取り、数値に変換

  const [isLoading, setIsLoading] = useState(false); // 登録中のローディング
  const [instructorInfo, setInstructorInfo] = useState<{ uid: string; userName: string } | null>(null);

  // コンポーネントがマウントされた際に講師情報を取得
  useEffect(() => {
    const fetchInstructorInfo = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setInstructorInfo({
              uid: user.uid,
              userName: userData.userName || '匿名講師', // プロフィールに名前がなければ仮の値を設定
            });
          } else {
            // プロフィールデータが見つからない場合
            Alert.alert("エラー", "講師プロフィールが見つかりません。スキル登録にはプロフィールが必要です。");
            navigation.goBack(); // 前の画面に戻る
          }
        } catch (error) {
          console.error("講師情報の取得エラー:", error);
          Alert.alert("エラー", "講師情報の取得に失敗しました。");
          navigation.goBack(); // エラー発生時も戻る
        }
      } else {
        // ログインしていない場合はログイン画面へ（本来はこの画面には来ないはず）
        Alert.alert("エラー", "ログインしていません。スキル登録にはログインが必要です。");
        navigation.navigate('Login' as never);
      }
    };
    fetchInstructorInfo();
  }, []);

  // スキルを登録する関数
  const handleSubmitSkill = async () => {
    if (!instructorInfo) {
      Alert.alert("エラー", "講師情報が読み込まれていません。");
      return;
    }
    // 入力値のバリデーション
    if (!title.trim() || !description.trim() || !category.trim() || !price.trim() || !duration.trim()) {
      Alert.alert("入力エラー", "全ての項目を入力してください。");
      return;
    }

    const parsedPrice = parseInt(price, 10);
    const parsedDuration = parseInt(duration, 10);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("入力エラー", "料金は有効な数値を入力してください。");
      return;
    }
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      Alert.alert("入力エラー", "時間は有効な数値を入力してください。");
      return;
    }

    setIsLoading(true); // ローディング開始

    try {
      const skillsCollectionRef = collection(db, 'skills');
      await addDoc(skillsCollectionRef, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: parsedPrice,
        duration: parsedDuration,
        instructorId: instructorInfo.uid,
        instructorName: instructorInfo.userName,
        createdAt: new Date().toISOString(), // 登録日時
      });

      Alert.alert('登録完了', 'スキルが正常に登録されました！');
      navigation.goBack(); // スキル一覧画面またはホーム画面に戻る
    } catch (error) {
      console.error("スキル登録エラー:", error);
      Alert.alert("登録失敗", "スキルの登録中にエラーが発生しました。");
    } finally {
      setIsLoading(false); // ローディング終了
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>スキルを登録する</Text>
        <Text style={styles.subtitle}>あなたの「一芸」を教えてください</Text>

        <TextInput
          style={styles.input}
          placeholder="スキルタイトル (例: 究極の卵焼きの作り方)"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#888" // プレースホルダーの色を追加
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="スキルの説明 (詳細に)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top" // Androidでのテキストの開始位置
          placeholderTextColor="#888"
        />
        <TextInput
          style={styles.input}
          placeholder="カテゴリ (例: 料理, ゲーム, 学習)"
          value={category}
          onChangeText={setCategory}
          placeholderTextColor="#888"
        />
        <TextInput
          style={styles.input}
          placeholder="料金 (¥, 例: 1000)"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric" // 数値入力キーボード
          placeholderTextColor="#888"
        />
        <TextInput
          style={styles.input}
          placeholder="所要時間 (分, 例: 30)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric" // 数値入力キーボード
          placeholderTextColor="#888"
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmitSkill} disabled={isLoading}>
          <Text style={styles.buttonText}>スキルを登録</Text>
        </TouchableOpacity>

        {isLoading && (
          <ActivityIndicator size="large" color="#00796B" style={styles.loadingIndicator} />
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
    fontSize: 18,
    marginBottom: 30,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    width: '90%',
    padding: Platform.OS === 'ios' ? 15 : 10, // Platform.OSはインポートされていませんが、以前のコードから残っています
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#B2EBF2',
    borderRadius: 10, // 角丸
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    shadowColor: '#000', // シャドウを追加
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: { // 共通ボタン
    width: '90%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#00796B',
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
  loadingIndicator: {
    marginTop: 20,
  },
});
