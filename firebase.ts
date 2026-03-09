
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0dOGz0xBEDwAMGzTW587uSDGhNor_6sY",
  authDomain: "forstudents-e1117.firebaseapp.com",
  projectId: "forstudents-e1117",
  storageBucket: "forstudents-e1117.firebasestorage.app",
  messagingSenderId: "735092212801",
  appId: "1:735092212801:web:abe3104cbeae011dd932c0",
  measurementId: "G-7G2SLZQ9P6"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
firebase.analytics();

export const auth = firebase.auth();
export const firestore = firebase.firestore();
export default firebase;

// Explicitly set persistence to LOCAL to ensure mobile PWA sessions survive redirects
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error: any) => {
    console.error("Error setting auth persistence:", error);
  });
