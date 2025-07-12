// ProfileRegistrationScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from './firebaseConfig';
// --- 変更箇所 ---: updateDoc を import に追加
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export default function ProfileRegistrationScreen() {
  const navigation = useNavigation();
  const [userName, setUserName] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // const [currentUserId, setCurrentUserId] = useState<string | null>(null); // このstateは不要なため削除

  // プロフィールデータを読み込む関数 (変更なし)
  const fetchUserProfile = async () => {
    setIsLoading(true);
    const user = auth.currentUser;
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUserName(userData.userName || '');
          setBio(userData.bio || '');
        } else {
          // このケースはLoginScreenでドキュメントが作成されるため、通常は発生しません
          Alert.alert("お知らせ", "プロフィールデータが見つかりません。新規登録時の情報で表示します。");
          setUserName(user.email ? user.email.split('@')[0] : '名無しさん');
          setBio('まだ自己紹介がありません。');
        }
      } catch (error) {
        console.error("プロフィールデータの取得エラー:", error);
        Alert.alert("エラー", "プロフィールデータの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert("エラー", "ログインしていません。");
      navigation.navigate('Login' as never);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // --- 変更箇所 ---: プロフィールを保存する関数を全面的に修正
  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("エラー", "ログインしていません。");
      return;
    }
    if (!userName.trim()) {
      Alert.alert("入力エラー", "ユーザー名を入力してください。");
      return;
    }

    setIsLoading(true);
    const userDocRef = doc(db, 'users', user.uid);

    try {
      const userDocSnap = await getDoc(userDocRef);

      // 更新用のデータオブジェクトを作成
      const dataToUpdate: { [key: string]: any } = {
        userName: userName,
        bio: bio,
        updatedAt: new Date().toISOString(),
      };

      // ドキュメントが存在し、かつ 'points' フィールドが存在しない場合のみ初期値を追加
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.points === undefined) {
          dataToUpdate.points = 0;
        }
        // 既存のドキュメントを更新
        await updateDoc(userDocRef, dataToUpdate);
      } else {
        // フォールバックとして、ドキュメントが存在しない場合は新規作成
        // (LoginScreenで作成されるため、通常この処理は不要)
        dataToUpdate.points = 0;
        dataToUpdate.createdAt = new Date().toISOString();
        dataToUpdate.uid = user.uid;
        dataToUpdate.email = user.email;
        await setDoc(userDocRef, dataToUpdate);
      }

      Alert.alert('登録完了', 'プロフィールが正常に登録されました！');
      navigation.navigate('Home' as never);

    } catch (error) {
      console.error("プロフィールの保存中にエラーが発生しました:", error);
      Alert.alert("保存失敗", "プロフィールの保存中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>プロフィールを読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>プロフィール登録</Text>
        <Text style={styles.subtitle}>基本情報を入力してください</Text>

        <TextInput
          style={styles.input}
          placeholder="ユーザー名"
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="none"
          placeholderTextColor="#888"
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="自己紹介"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholderTextColor="#888"
        />

        <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={isLoading}>
          <Text style={styles.buttonText}>プロフィールを保存</Text>
        </TouchableOpacity>
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
    color: '#555',
    textAlign: 'center',
  },
  input: {
    width: '90%',
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#B2EBF2',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  button: {
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
});
