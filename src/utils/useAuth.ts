import { useState, useEffect } from 'react';
import { auth } from './firebase';
import {
    onAuthStateChanged,
    type User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from 'firebase/auth';

type AuthErrorLike = {
    code?: unknown;
};

const getAuthErrorCode = (error: unknown) => {
    if (!error || typeof error !== 'object') return '';
    const code = (error as AuthErrorLike).code;
    return typeof code === 'string' ? code : '';
};

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
        const pass = `fixed-pass-${campusId}`;

        try {
            return await signInWithEmailAndPassword(auth, email, pass);
        } catch (err: unknown) {
            const code = getAuthErrorCode(err);
            console.log("Login error code:", code);
            // アカウントが存在しない、またはクレデンシャルが無効（新規）な場合は自動作成
            if (
                code === 'auth/user-not-found' ||
                code === 'auth/invalid-credential' ||
                code === 'auth/wrong-password' ||
                code === 'auth/invalid-email'
            ) {
                try {
                    return await createUserWithEmailAndPassword(auth, email, pass);
                } catch (signupErr: unknown) {
                    console.error("Signup error after login fail:", signupErr);
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
