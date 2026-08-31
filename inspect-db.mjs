import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD3DC0yJXi7mq1HW30-lRceZugIcdD310I",
  authDomain: "fariaspallets.firebaseapp.com",
  projectId: "fariaspallets",
  storageBucket: "fariaspallets.firebasestorage.app",
  messagingSenderId: "680609023950",
  appId: "1:680609023950:web:9f5ba19ca15437d3a80d9f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log('--- INDÚSTRIAS ---');
  const inds = await getDocs(collection(db, 'industries'));
  inds.docs.forEach((d) => console.log(d.id, d.data()));

  console.log('--- MOVIMENTAÇÕES ---');
  const movs = await getDocs(collection(db, 'movements'));
  movs.docs.forEach((d) => console.log(d.id, d.data()));
  process.exit(0);
}

inspect().catch(console.error);
