import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, Alert, TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { auth, db } from './firebaseConfig';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigation = useNavigation();

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSignUp = async () => {
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (user) {
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    userName: email.split('@')[0],
                    bio: '',
                    skills: [],
                    createdAt: new Date().toISOString(),
                });
            }
            Alert.alert('登録成功', '新しいアカウントが作成されました！');
        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async () => {
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            setError('メールアドレスまたはパスワードが正しくありません。');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = () => {
        setError('');
        setSuccessMessage('');
        if (!email) {
            // --- ここを変更しました ---
            setError('パスワードを再設定するには、まずメールアドレスを入力してください。');
            return;
        }
        sendPasswordResetEmail(auth, email)
            .then(() => {
                setSuccessMessage(`${email} にパスワード再設定用のメールを送信しました。`);
            })
            .catch((error) => {
                setError('メールの送信に失敗しました。');
                console.error(error);
            });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>一芸入魂</Text>
            <Text style={styles.subtitle}>スキルを共有するコミュニティ</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

            <TextInput
                style={styles.input}
                placeholder="メールアドレス"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#888"
            />
            <TextInput
                style={styles.input}
                placeholder="パスワード (6文字以上)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#888"
            />
            
            <TouchableOpacity style={[styles.button, styles.signUpButton]} onPress={handleSignUp} disabled={isLoading}>
                {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.buttonText}>新規登録 (サインアップ)</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={handleLogin} disabled={isLoading}>
                 {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.buttonText}>ログイン</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPasswordButton} onPress={handlePasswordReset}>
                <Text style={styles.forgotPasswordText}>パスワードをお忘れですか？</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E0F2F7',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#00796B',
    },
    subtitle: {
        fontSize: 18,
        marginBottom: 20,
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
    },
    button: {
        width: '90%',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
        height: 55,
        justifyContent: 'center',
    },
    signUpButton: {
        backgroundColor: '#4CAF50',
    },
    loginButton: {
        backgroundColor: '#2196F3',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    forgotPasswordButton: {
        marginTop: 15,
    },
    forgotPasswordText: {
        color: '#00796B',
        fontSize: 16,
        textDecorationLine: 'underline',
    },
    errorText: {
        width: '90%',
        color: '#D32F2F',
        fontSize: 14,
        marginBottom: 15,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    successText: {
        width: '90%',
        color: '#388E3C',
        fontSize: 14,
        marginBottom: 15,
        textAlign: 'center',
        fontWeight: 'bold',
    },
});
