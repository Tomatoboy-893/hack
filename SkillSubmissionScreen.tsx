// SkillSubmissionScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from './firebaseConfig';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ★変更点: カテゴリをさらに拡充
const HIERARCHICAL_CATEGORIES = [
  {
    parent: 'IT・テクノロジー',
    children: ['プログラミング', 'Webデザイン', '動画編集', 'データサイエンス', 'Excel・PCスキル', 'ITインフラ']
  },
  {
    parent: 'ビジネス・キャリア',
    children: ['マーケティング', 'キャリア相談', '資料作成', '起業・副業', 'ライティング', 'プレゼンテーション']
  },
  {
    parent: 'クリエイティブ',
    children: ['写真・カメラ', '音楽・DTM', 'アート・イラスト', 'ハンドメイド', 'デザイン', '作詞・作曲']
  },
  {
    parent: 'ライフスタイル・健康',
    children: ['料理・お菓子作り', 'フィットネス・筋トレ', 'ヨガ・ピラティス', '美容・メイク', '片付け・整理収納', 'ガーデニング']
  },
  {
    parent: '語学・教養',
    children: ['英語', '韓国語', '中国語', 'その他言語', '資格取得', '金融・投資']
  },
  {
    parent: 'エンタメ・趣味',
    children: ['ゲーム', '占い', 'マジック', '書道・ペン字', 'eスポーツ', 'ボードゲーム']
  }
];

export default function SkillSubmissionScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState('');

  // ★変更点: 開いている親カテゴリを管理するstate
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [instructorInfo, setInstructorInfo] = useState<{ uid: string; userName: string } | null>(null);

  useEffect(() => {
    // ... 既存のfetchInstructorInfoロジック (変更なし)
  }, []);

  const handleSubmitSkill = async () => {
    // ... 既存のhandleSubmitSkillロジック (変更なし)
  };
  
  // ★変更点: アコーディオンを開閉する関数
  const toggleAccordion = (parentCategory: string) => {
    if (expandedCategory === parentCategory) {
      setExpandedCategory(null); // 同じものを再度タップしたら閉じる
    } else {
      setExpandedCategory(parentCategory); // 違うものをタップしたら開く
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>スキルを登録する</Text>
        <Text style={styles.subtitle}>あなたの「一芸」を教えてください</Text>

        <TextInput style={styles.input} placeholder="スキルタイトル..." value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, styles.textArea]} placeholder="スキルの説明..." value={description} onChangeText={setDescription} multiline />
        
        {/* ★変更点: カテゴリ選択をアコーディオンUIに変更 */}
        <View style={styles.categorySection}>
          <Text style={styles.label}>カテゴリを選択</Text>
          {HIERARCHICAL_CATEGORIES.map((catGroup) => (
            <View key={catGroup.parent}>
              {/* 親カテゴリのボタン */}
              <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleAccordion(catGroup.parent)}>
                <Text style={styles.accordionHeaderText}>{catGroup.parent}</Text>
                <MaterialCommunityIcons 
                  name={expandedCategory === catGroup.parent ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#333"
                />
              </TouchableOpacity>
              {/* 子カテゴリの表示エリア (開いている場合のみ) */}
              {expandedCategory === catGroup.parent && (
                <View style={styles.accordionBody}>
                  {catGroup.children.map((subCat) => (
                    <TouchableOpacity
                      key={subCat}
                      style={[
                        styles.subcategoryButton,
                        category === subCat && styles.selectedSubcategoryButton
                      ]}
                      onPress={() => setCategory(subCat)}
                    >
                      <Text style={[styles.subcategoryText, category === subCat && styles.selectedSubcategoryText]}>
                        {subCat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        <TextInput style={styles.input} placeholder="料金 (¥)" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="所要時間 (分)" value={duration} onChangeText={setDuration} keyboardType="numeric" />

        <TouchableOpacity style={styles.button} onPress={handleSubmitSkill} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>スキルを登録</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ★変更点: スタイルをアコーディオンUI用に更新
const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20, backgroundColor: '#F7F9FA' },
  container: { alignItems: 'center', padding: 20, width: '100%' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 10, color: '#00796B' },
  subtitle: { fontSize: 16, marginBottom: 25, color: '#555' },
  label: { fontSize: 16, fontWeight: '600', color: '#333', alignSelf: 'flex-start', width: '90%', marginLeft: '5%', marginBottom: 10 },
  input: { width: '90%', padding: 14, marginBottom: 15, borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, backgroundColor: '#FFFFFF', fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  categorySection: {
    width: '90%',
    marginBottom: 15,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 1, 
  },
  accordionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  accordionBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 10,
    paddingLeft: 5,
    paddingRight: 5,
    paddingBottom: 5,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: 10,
  },
  subcategoryButton: {
    backgroundColor: '#ECEFF1',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    margin: 5,
  },
  selectedSubcategoryButton: {
    backgroundColor: '#00796B',
  },
  subcategoryText: {
    fontSize: 14,
    color: '#37474F',
  },
  selectedSubcategoryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  button: { width: '90%', padding: 15, borderRadius: 10, alignItems: 'center', backgroundColor: '#00796B', marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});
