import { useState, useEffect } from 'react';
import { auth } from './firebase';
import {
    onAuthStateChanged,
    type User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from 'firebase/auth';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const loginByCampus = async (campusId: string) => {
        const email = `${campusId}@campus.local`;
        const pass = `fixed-pass-${campusId}`; // 簡略化のため固定パスワードを使用

        try {
            return await signInWithEmailAndPassword(auth, email, pass);
        } catch (err: any) {
            // アカウントが存在しない場合は自動作成
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                try {
                    return await createUserWithEmailAndPassword(auth, email, pass);
                } catch (signupErr) {
                    throw signupErr;
                }
            }
            throw err;
        }
    };

    const logout = async () => {
        return signOut(auth);
    };

    return {
        user,
        loading,
        loginByCampus,
        logout
    };
};
