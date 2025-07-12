// SkillListScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { db } from './firebaseConfig';
import { collection, getDocs, query } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const HIERARCHICAL_CATEGORIES = [
  { parent: 'IT・テクノロジー', children: ['プログラミング', 'Webデザイン', '動画編集', 'データサイエンス', 'Excel・PCスキル', 'ITインフラ'] },
  { parent: 'ビジネス・キャリア', children: ['マーケティング', 'キャリア相談', '資料作成', '起業・副業', 'ライティング', 'プレゼンテーション'] },
  { parent: 'クリエイティブ', children: ['写真・カメラ', '音楽・DTM', 'アート・イラスト', 'ハンドメイド', 'デザイン', '作詞・作曲'] },
  { parent: 'ライフスタイル・健康', children: ['料理・お菓子作り', 'フィットネス・筋トレ', 'ヨガ・ピラティス', '美容・メイク', '片付け・整理収納', 'ガーデニング'] },
  { parent: '語学・教養', children: ['英語', '韓国語', '中国語', 'その他言語', '資格取得', '金融・投資'] },
  { parent: 'エンタメ・趣味', children: ['ゲーム', '占い', 'マジック', '書道・ペン字', 'eスポーツ', 'ボードゲーム'] },
];

interface Skill {
  id: string;
  title: string;
  description: string;
  category: string;
  points: number;
  instructorId: string;
  instructorName: string;
  duration: number;
  createdAt: any;
}

type SortOption = 'title' | 'newest';

export default function SkillListScreen() {
  const navigation = useNavigation<any>();
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [parentCategories, setParentCategories] = useState<string[]>([]);
  const [childCategories, setChildCategories] = useState<string[]>([]);
  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>('全て');
  const [selectedChildCategory, setSelectedChildCategory] = useState<string | null>(null);

  const [sortOption, setSortOption] = useState<SortOption>('title');

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const skillsCollectionRef = collection(db, 'skills');
        const q = query(skillsCollectionRef);
        const querySnapshot = await getDocs(q);

        const fetchedSkills: Skill[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt || new Date(0).toISOString(),
        } as Skill));

        setAllSkills(fetchedSkills);
        setParentCategories(['全て', ...HIERARCHICAL_CATEGORIES.map(c => c.parent)]);
        setFilteredSkills(fetchedSkills); 
      } catch (error) {
        console.error("スキルデータの取得エラー:", error);
        Alert.alert("エラー", "スキルデータの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSkills();
  }, []);

  useEffect(() => {
    let currentFilteredSkills = [...allSkills];

    if (selectedParentCategory && selectedParentCategory !== '全て') {
      const parentInfo = HIERARCHICAL_CATEGORIES.find(p => p.parent === selectedParentCategory);
      const categoriesInParent = parentInfo ? parentInfo.children : [];
      currentFilteredSkills = currentFilteredSkills.filter(skill =>
        categoriesInParent.includes(skill.category)
      );
    }

    // ✨ 1. 小カテゴリの絞り込み条件をシンプルに変更
    if (selectedChildCategory) {
      currentFilteredSkills = currentFilteredSkills.filter(
        skill => skill.category === selectedChildCategory
      );
    }
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    if (lowerCaseQuery) {
      currentFilteredSkills = currentFilteredSkills.filter(skill => (
        skill.title.toLowerCase().includes(lowerCaseQuery) ||
        skill.description.toLowerCase().includes(lowerCaseQuery) ||
        skill.category.toLowerCase().includes(lowerCaseQuery) ||
        skill.instructorName.toLowerCase().includes(lowerCaseQuery)
      ));
    }

    switch (sortOption) {
      case 'newest':
        currentFilteredSkills.sort((a, b) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt).getTime() - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt).getTime());
        break;
      case 'title':
      default:
        currentFilteredSkills.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    setFilteredSkills(currentFilteredSkills);
  }, [searchQuery, selectedParentCategory, selectedChildCategory, allSkills, sortOption]);

  const handleSelectParentCategory = (parent: string) => {
    if (selectedParentCategory === parent) {
      setSelectedParentCategory('全て');
      setSelectedChildCategory(null);
      setChildCategories([]);
    } else {
      setSelectedParentCategory(parent);
      setSelectedChildCategory(null); // 親を変えたら子の選択はリセット
      if (parent !== '全て') {
        const parentInfo = HIERARCHICAL_CATEGORIES.find(p => p.parent === parent);
        // ✨ 2. 小カテゴリのリストから「全て」を削除
        setChildCategories(parentInfo ? parentInfo.children : []);
      } else {
        setChildCategories([]);
      }
    }
  };

  const handleBookSkill = (skill: Skill) => {
    navigation.navigate('Booking', { skillId: skill.id, skillTitle: skill.title, skillPoints: skill.points, instructorId: skill.instructorId, instructorName: skill.instructorName });
  };
  
  const renderSkillItem = ({ item }: { item: Skill }) => (
    <View style={styles.skillItem}>
      <Text style={styles.skillTitle}>{item.title}</Text>
      <Text style={styles.skillInstructor}>講師: {item.instructorName}</Text>
      <Text style={styles.skillDescription}>{item.description}</Text>
      <Text style={styles.skillDetails}>カテゴリ: {item.category} | ポイント: {item.points}pt | 時間: {item.duration}分</Text>
      <TouchableOpacity style={styles.bookButton} onPress={() => handleBookSkill(item)}>
        <Text style={styles.bookButtonText}>予約する</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderCategoryButton = (item: string, type: 'parent' | 'child') => {
    const isSelected = type === 'parent' ? selectedParentCategory === item : selectedChildCategory === item;
    const onPress = () => {
      if (type === 'parent') {
        handleSelectParentCategory(item);
      } else {
        // ✨ 3. 同じ小カテゴリをタップしたら選択解除(nullに設定)する
        setSelectedChildCategory(prev => prev === item ? null : item);
      }
    };
    return (
      <TouchableOpacity
        style={[styles.categoryButton, isSelected && styles.categoryButtonSelected]}
        onPress={onPress}
      >
        <Text style={[styles.categoryButtonText, isSelected && styles.categoryButtonTextSelected]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };
  
  const SortButton = ({ type, label }: { type: SortOption, label: string }) => (
    <TouchableOpacity
      style={[styles.sortButton, sortOption === type && styles.sortButtonSelected]}
      onPress={() => setSortOption(type)}
    >
      <Text style={[styles.sortButtonText, sortOption === type && styles.sortButtonTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#00796B" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="スキルを検索 (タイトル、カテゴリ、講師名など)"
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="always"
        placeholderTextColor="#888"
      />

      <View style={styles.categoryFilterContainer}>
        <FlatList
          data={parentCategories}
          renderItem={({ item }) => renderCategoryButton(item, 'parent')}
          keyExtractor={(item) => `parent-${item}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContent}
        />
      </View>

      {selectedParentCategory && selectedParentCategory !== '全て' && (
        <View style={styles.categoryFilterContainer}>
          <FlatList
            data={childCategories}
            renderItem={({ item }) => renderCategoryButton(item, 'child')}
            keyExtractor={(item) => `child-${item}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryListContent}
          />
        </View>
      )}

      <View style={styles.sortContainer}>
        <SortButton type="title" label="タイトル順" />
        <SortButton type="newest" label="新着順" />
      </View>
      
      {filteredSkills.length === 0 ? (
        <Text style={styles.emptyText}>該当するスキルが見つかりませんでした。</Text>
      ) : (
        <FlatList
          data={filteredSkills}
          renderItem={renderSkillItem}
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
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 15,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#B2EBF2',
    fontSize: 16,
  },
  categoryFilterContainer: {
    paddingVertical: 5,
    marginBottom: 5,
    paddingLeft: 15,
  },
  categoryListContent: {
    alignItems: 'center',
    paddingRight: 15,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  categoryButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  categoryButtonText: {
    color: '#3F51B5',
    fontWeight: 'bold',
    fontSize: 14,
  },
  categoryButtonTextSelected: {
    color: '#FFFFFF',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 15,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 10,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BDBDBD',
    marginRight: 10,
  },
  sortButtonSelected: {
    backgroundColor: '#00796B',
    borderColor: '#00796B',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  sortButtonTextSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 15,
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
  skillInstructor: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
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
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#555',
  },
  bookButton: {
    backgroundColor: '#FF5722',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
