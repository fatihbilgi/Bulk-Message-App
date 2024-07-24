import React, { useState } from 'react';
import './LoginPage.css';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const auth = getAuth();
const firestore = getFirestore();

async function getIpAddress() {
    const response = await fetch('https://api.ipify.org?format=json');

    if (response.ok) {
        const data = await response.json();
        return data.ip;
    } else {
        throw new Error('Failed to fetch IP address');
    }
}

const logLogin = async (email, ipAddress, deviceInfo) => {
    try {
        const logRef = collection(firestore, 'loginLogs');
        await addDoc(logRef, {
            email: email,
            timestamp: new Date(),
            ipAddress: ipAddress,
            deviceInfo: deviceInfo
        });
        console.log('Login logged successfully');
    } catch (error) {
        console.error('Error logging login:', error);
    }
};

const logError = async (errorDetails, ipAddress, deviceInfo) => {
    try {
        const logRef = collection(firestore, 'errorLogs');
        await addDoc(logRef, {
            timestamp: new Date(),
            errorDetails: errorDetails,
            ipAddress: ipAddress,
            deviceInfo: deviceInfo
        });
        console.log('Error logged successfully');
    } catch (error) {
        console.error('Error logging error:', error);
    }
};

const LoginPage = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
          handleLogin(event);
        }
      };

    const handleLogin = () => {
        signInWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                console.log('Login is successful');
                const ipAddress = await getIpAddress();
                const deviceInfo = navigator.userAgent;
                logLogin(user.email, ipAddress, deviceInfo);
                onLogin();
            })
            .catch(async (error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error(errorMessage);

                const errorDetails = {
                    errorCode: errorCode,
                    errorMessage: errorMessage
                };
                const ipAddress = await getIpAddress();
                const deviceInfo = navigator.userAgent;
                logError(errorDetails, ipAddress, deviceInfo);

                if (errorCode === 'auth/invalid-email') {
                    alert('Invalid e-mail address!');
                } else if (errorCode === 'auth/user-disabled') {
                    alert('This account is disabled!');
                } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
                    alert('E-mail or password is incorrect!');
                }
                else {
                    alert(errorMessage);
                }
            });
    };

    return (
        <div className="login-page">
            <div className="login-form">
                <h2>Login</h2>
                <input
                    id='userField'
                    type="email" // input tipi email olarak değiştirildi
                    placeholder="E-mail" // Placeholder "E-mail" olarak değiştirildi
                    className="login-input"
                    value={email} // State email olarak değiştirildi
                    onKeyDown={handleKeyDown}
                    onChange={(e) => setEmail(e.target.value)} // State email olarak değiştirildi
                />
                <input
                    id='passwordField'
                    type="password"
                    placeholder="Password"
                    className="login-input"
                    value={password}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type='submit' className="login-button" onClick={handleLogin}>Login</button>
            </div>
        </div>
    );
};

export default LoginPage;
