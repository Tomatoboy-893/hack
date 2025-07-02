// App.tsx

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet, ActivityIndicator, Button } from 'react-native'; // Buttonを使用

// 各画面コンポーネントをインポート
import LoginScreen from './LoginScreen'; 
import ProfileRegistrationScreen from './ProfileRegistrationScreen'; 
import SkillListScreen from './SkillListScreen'; 
import SkillSubmissionScreen from './SkillSubmissionScreen';
import ProfileScreen from './ProfileScreen'; 
import BookingScreen from './BookingScreen'; 
import InstructorAvailabilityScreen from './InstructorAvailabilityScreen'; 
import MySkillsManagementScreen from './MySkillsManagementScreen'; 
import MyBookingsScreen from './MyBookingsScreen'; 

// Firebase関連のインポート
import { auth } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 

// ナビゲーターのインスタンスを作成
const Stack = createNativeStackNavigator();

// --- 未認証ユーザー用のナビゲーター（認証スタック） ---
function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }} // ログイン画面のヘッダーは非表示
      />
      <Stack.Screen
        name="ProfileRegistration"
        component={ProfileRegistrationScreen}
        options={{ title: 'プロフィール登録' }} // プロフィール登録画面のタイトル
      />
    </Stack.Navigator>
  );
}

// --- 認証済みユーザー用のナビゲーター（アプリスタック） ---
function AppStack() {
  // ログアウト処理
  const handleLogout = async () => {
    console.log("ログアウトボタンが押されました。"); 
    if (!auth) {
      console.error("エラー: authオブジェクトが未定義です。"); 
      alert("ログアウトに失敗しました。認証設定を確認してください。");
      return;
    }
    if (!auth.currentUser) {
      console.warn("警告: ログアウト試行時、currentUserはnullです。既にログアウト済みの可能性があります。"); 
      alert("既にログアウトされています。");
      return;
    }
    try {
      console.log("signOut関数を呼び出し中です..."); 
      await signOut(auth); 
      console.log("signOut関数が正常に完了しました。"); 
    } catch (error) {
      console.error("ログアウトエラー:", error); 
      alert("ログアウトに失敗しました。"); 
    }
  };

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        options={{ title: '一芸入魂' }}
      >
        {({ navigation }: any) => (
          // ホーム画面のコンテンツ
          <View style={styles.container}>
            <Text style={styles.title}>ホーム画面 - ようこそ！</Text>
            <Text style={styles.text}>ここにスキル検索やプロファイルなどのコンテンツが来ます。</Text>
            
            <View style={styles.buttonSpacing}>
              <Button title="スキル一覧を見る" onPress={() => navigation.navigate('SkillList')} color="#8A2BE2" />
            </View>

            <View style={styles.buttonSpacing}>
              <Button title="スキルを登録する" onPress={() => navigation.navigate('SkillSubmission')} color="#00796B" />
            </View>

            <View style={styles.buttonSpacing}>
              <Button title="自分のスキルを管理" onPress={() => navigation.navigate('MySkillsManagement')} color="#00BCD4" />
            </View>

            <View style={styles.buttonSpacing}>
              <Button title="プロフィールを見る/編集する" onPress={() => navigation.navigate('Profile')} color="#FFA500" />
            </View>

            <View style={styles.buttonSpacing}>
              <Button title="自分の予約を見る" onPress={() => navigation.navigate('MyBookings')} color="#FF8C00" />
            </View>

            <View style={styles.logoutButtonContainer}>
              <Button title="ログアウト" onPress={handleLogout} color="#FF6347" />
            </View>
          </View>
        )}
      </Stack.Screen>

      {/* 認証済みユーザーがアクセスできる他のスクリーン */}
      <Stack.Screen
        name="SkillList"
        component={SkillListScreen}
        options={{ title: 'スキル一覧' }} 
      />
      <Stack.Screen
        name="SkillSubmission"
        component={SkillSubmissionScreen}
        options={{ title: 'スキルを登録' }} 
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'プロフィール' }} 
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'スキル予約' }} 
      />
      <Stack.Screen
        name="InstructorAvailability"
        component={InstructorAvailabilityScreen}
        options={{ title: '開催日程を設定' }} 
      />
      <Stack.Screen
        name="MySkillsManagement"
        component={MySkillsManagementScreen}
        options={{ title: '自分のスキル管理' }}
      />
      <Stack.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ title: '自分の予約' }}
      />
    </Stack.Navigator>
  );
}

// アプリのメインコンポーネント
export default function App() {
  const [user, setUser] = useState<any | null | undefined>(undefined); 
  const [isLoading, setIsLoading] = useState(true); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser); 
      setIsLoading(false); 
    });
    return () => unsubscribe();
  }, []); 

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>認証状態を確認中...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

// --- スタイル定義 ---
const styles = StyleSheet.create({
  container: { // ホーム画面全体のスタイル
    flex: 1, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20, 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20, 
  },
  text: { 
    fontSize: 16, 
    marginBottom: 30, 
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
  logoutButtonContainer: { 
    marginTop: 20, 
    width: '60%', 
  },
  buttonSpacing: { 
    marginBottom: 10, 
    width: '60%', 
  }
});
