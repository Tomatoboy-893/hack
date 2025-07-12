// ProfileScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from './firebaseConfig'; 
import { doc, getDoc, setDoc } from 'firebase/firestore'; 

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [userName, setUserName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState(''); 
  const [points, setPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true); 
  const [isEditing, setIsEditing] = useState(false); 

  // プロフィールデータを読み込む関数
  const fetchUserProfile = async () => {
    setIsLoading(true);
    const user = auth.currentUser;
    if (user) {
      setEmail(user.email || 'メールアドレスなし'); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUserName(userData.userName || '');
          setBio(userData.bio || '');
          setPoints(userData.points || 0);
        } else {
          Alert.alert("お知らせ", "プロフィールデータが見つかりません。新規登録時の情報で表示します。");
          setUserName(user.email ? user.email.split('@')[0] : '名無しさん');
          setBio('まだ自己紹介がありません。');
          setPoints(10); //データがない場合は10を表示
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

  // プロフィールを保存する関数
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
    try {
      await setDoc(doc(db, 'users', user.uid), {
        userName: userName,
        bio: bio,
        points: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), 
      }, { merge: true }); 

      Alert.alert('保存完了', 'プロフィールが正常に更新されました！');
      setIsEditing(false); 
    } catch (error) {
      console.error("プロフィール保存エラー:", error);
      Alert.alert("保存失敗", "プロフィールの保存中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  // 編集ボタンを押したときのハンドラー
  const handleEditPress = () => {
    setIsEditing(true);
  };

  // キャンセルボタンを押したときのハンドラー
  const handleCancelPress = () => {
    setIsEditing(false);
    fetchUserProfile(); // 元のプロフィールデータを再読み込み
  };

  // ★変更: 開催日程設定画面へ遷移するハンドラーは削除
  // handleGoToAvailabilityは削除されます

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
        <Text style={styles.title}>あなたのプロフィール</Text>

        <View style={styles.profileItem}>
          <Text style={styles.label}>現在の所持ポイント:</Text>
          <Text style={styles.pointsValue}>{points} P</Text>
        </View>

        <View style={styles.profileItem}>
          <Text style={styles.label}>メールアドレス:</Text>
          <Text style={styles.value}>{email}</Text>
        </View>

        <View style={styles.profileItem}>
          <Text style={styles.label}>メールアドレス:</Text>
          <Text style={styles.value}>{email}</Text>
        </View>

        <View style={styles.profileItem}>
          <Text style={styles.label}>ユーザー名:</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={userName}
              onChangeText={setUserName}
              placeholderTextColor="#888"
            />
          ) : (
            <Text style={styles.value}>{userName || '未設定'}</Text>
          )}
        </View>

        <View style={styles.profileItem}>
          <Text style={styles.label}>自己紹介:</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#888"
            />
          ) : (
            <Text style={styles.value}>{bio || '未設定'}</Text>
          )}
        </View>

        {isEditing ? (
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveProfile} disabled={isLoading}>
              <Text style={styles.buttonText}>保存する</Text>
            </TouchableOpacity>
            <View style={styles.buttonSpacer} />
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancelPress} disabled={isLoading}>
              <Text style={styles.buttonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={[styles.button, styles.editButton]} onPress={handleEditPress}>
              <Text style={styles.buttonText}>編集する</Text>
            </TouchableOpacity>
            {/* ★変更: 開催日程設定ボタンを削除 */}
            {/* <View style={styles.buttonSpacer} /> 
            <TouchableOpacity style={[styles.button, styles.availabilityButton]} onPress={handleGoToAvailability}>
              <Text style={styles.buttonText}>開催日程を設定</Text> 
            </TouchableOpacity> */}
          </View>
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
    marginBottom: 30,
    color: '#00796B',
  },
  profileItem: {
    width: '90%',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  pointsValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00796B',
  },
  input: {
    width: '100%',
    padding: Platform.OS === 'ios' ? 12 : 10,
    borderWidth: 1,
    borderColor: '#B2EBF2',
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    fontSize: 16,
    marginTop: 5,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
    marginTop: 20,
    flexWrap: 'wrap', 
  },
  buttonSpacer: {
    width: 10,
    height: 10, 
  },
  button: { 
    flex: 1, 
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#00796B',
  },
  cancelButton: {
    backgroundColor: '#FF6347',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  availabilityButton: { // このスタイルはもう使われませんが、残しておきます
    backgroundColor: '#9C27B0', 
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
