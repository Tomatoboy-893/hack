// SkillListScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { db } from './firebaseConfig';
// ★変更点: orderByを削除し、クライアントサイドでソートするため
import { collection, getDocs, query } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

// ★変更点: Skillの型定義に並び替え用のプロパティを追加
interface Skill {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  instructorId: string;
  instructorName: string;
  duration: number;
  createdAt: any; // 新しい順ソート用
}

// ★変更点: 並び替えオプションの型を定義
type SortOption = 'title' | 'newest';

export default function SkillListScreen() {
  const navigation = useNavigation();
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ★変更点: 並び替えオプション用のstateを追加 (デフォルトはタイトル順)
  const [sortOption, setSortOption] = useState<SortOption>('title');

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const skillsCollectionRef = collection(db, 'skills');
        // ★変更点: FirestoreクエリでのorderByを削除。クライアント側で柔軟にソートするため。
        const q = query(skillsCollectionRef);
        const querySnapshot = await getDocs(q);

        const fetchedSkills: Skill[] = [];
        const uniqueCategories: Set<string> = new Set();
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // ★変更点: createdAtがない場合に備えてデフォルト値を設定
          const skill = {
            id: doc.id,
            ...data,
            createdAt: data.createdAt || new Date(0).toISOString(),
          } as Skill;
          fetchedSkills.push(skill);
          uniqueCategories.add(skill.category);
        });

        setAllSkills(fetchedSkills);
        setCategories(['全て', ...Array.from(uniqueCategories).sort()]);
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

  // ★変更点: 検索、カテゴリ、並び替え順が変わるたびにフィルタリングとソートを実行
  useEffect(() => {
    let currentFilteredSkills = [...allSkills];

    // カテゴリでフィルタリング
    if (selectedCategory && selectedCategory !== '全て') {
      currentFilteredSkills = currentFilteredSkills.filter(
        skill => skill.category === selectedCategory
      );
    }

    // 検索クエリによるフィルタリング
    const lowerCaseQuery = searchQuery.toLowerCase();
    if (lowerCaseQuery) {
      currentFilteredSkills = currentFilteredSkills.filter(skill => {
        return (
          skill.title.toLowerCase().includes(lowerCaseQuery) ||
          skill.description.toLowerCase().includes(lowerCaseQuery) ||
          skill.category.toLowerCase().includes(lowerCaseQuery) ||
          skill.instructorName.toLowerCase().includes(lowerCaseQuery)
        );
      });
    }

    // ★変更点: 並び替えを実行
    switch (sortOption) {
      case 'newest':
        // createdAtの日付で降順ソート
        currentFilteredSkills.sort((a, b) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt).getTime() - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt).getTime());
        break;
      case 'title':
      default:
        // タイトルで昇順ソート
        currentFilteredSkills.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    setFilteredSkills(currentFilteredSkills);
  }, [searchQuery, selectedCategory, allSkills, sortOption]); // sortOptionを依存配列に追加

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796B" />
        <Text style={styles.loadingText}>スキルデータを読み込み中...</Text>
      </View>
    );
  }

  const handleBookSkill = (skill: Skill) => {
    navigation.navigate('Booking', { skillId: skill.id, skillTitle: skill.title, skillPrice: skill.price, instructorId: skill.instructorId, instructorName: skill.instructorName });
  };

  const renderSkillItem = ({ item }: { item: Skill }) => (
    <View style={styles.skillItem}>
      <Text style={styles.skillTitle}>{item.title}</Text>
      <Text style={styles.skillInstructor}>講師: {item.instructorName}</Text>
      <Text style={styles.skillDescription}>{item.description}</Text>
      <Text style={styles.skillDetails}>カテゴリ: {item.category} | 料金: ¥{item.price} | 時間: {item.duration}分</Text>
      <TouchableOpacity style={styles.bookButton} onPress={() => handleBookSkill(item)}>
        <Text style={styles.bookButtonText}>予約する</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCategoryButton = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        selectedCategory === item ? styles.categoryButtonSelected : {},
      ]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text style={[styles.categoryButtonText, selectedCategory === item ? styles.categoryButtonTextSelected : {}]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  // ★変更点: 並び替えボタンのUI定義
  const SortButton = ({ type, label }: { type: SortOption, label: string }) => (
    <TouchableOpacity
      style={[styles.sortButton, sortOption === type ? styles.sortButtonSelected : {}]}
      onPress={() => setSortOption(type)}
    >
      <Text style={[styles.sortButtonText, sortOption === type ? styles.sortButtonTextSelected : {}]}>{label}</Text>
    </TouchableOpacity>
  );

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
          data={categories}
          renderItem={renderCategoryButton}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContent}
        />
      </View>

      {/* ★変更点: 並び替えボタンのコンテナを追加 */}
      <View style={styles.sortContainer}>
        <SortButton type="title" label="タイトル順" />
        <SortButton type="newest" label="新着順" />
      </View>

      {filteredSkills.length === 0 ? (
        <Text style={styles.emptyText}>
          {searchQuery || (selectedCategory && selectedCategory !== '全て')
            ? '検索条件に一致するスキルが見つかりませんでした。'
            : 'スキルがまだ登録されていません。'}
        </Text>
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

// ★変更点: 並び替えボタン関連のスタイルを追加
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
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#B2EBF2',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryFilterContainer: {
    height: 50,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#FFFFFF',
    paddingLeft: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryListContent: {
    alignItems: 'center',
    paddingRight: 15,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#BBDEBFB',
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
    paddingHorizontal: 20,
  },
  bookButton: {
    backgroundColor: '#FF5722',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
