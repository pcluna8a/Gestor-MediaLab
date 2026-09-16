import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDNbMkUW0VZibUhpZChtAnCWD1qMZ3Hllw",
  authDomain: "gestor-medialab-sena.firebaseapp.com",
  projectId: "gestor-medialab-sena",
  storageBucket: "gestor-medialab-sena.firebasestorage.app",
  messagingSenderId: "366861561386",
  appId: "1:366861561386:web:4ddab8b9ba88e7edfa9d53"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const aprendices = [
  { id: "1003810379", name: "KAREN VANESSA FALLA HEREDIA", emailGoogle: "vanesithafalla559@gmail.com" },
  { id: "1003895841", name: "DARWIN ROA MARIN", emailGoogle: "darwinroamarin@gmail.com" },
  { id: "1029880390", name: "LAURA SOFIA OTALORA RAMIREZ", emailGoogle: "laurasofiiramirez@icloud.com" },
  { id: "1029882294", name: "TANIA KATERIN ESQUIVEL CHACON", emailGoogle: "taniakaterinesquivelchacon@gmail.com" },
  { id: "1073681685", name: "KAREN JULIETH RAMIREZ FALLA", emailGoogle: "karenjuliethramirezfalla@gmail.com" },
  { id: "1075215351", name: "MAIRA ALEJANDRA SUAREZ PERDOMO", emailGoogle: "abbby1612@gmail.com" },
  { id: "1075219203", name: "JULIAN DAVID LIS TAO", emailGoogle: "juliandavidlistao8@gmail.com" },
  { id: "1075235951", name: "JESMAN JORLEY FIRIGUA MURCIA", emailGoogle: "jesmanmurcia@gmail.com" },
  { id: "1075244982", name: "DIEGO FERNANDO HERRERA GARCIA", emailGoogle: "diegoherreragar@hotmail.es" },
  { id: "1075279301", name: "MARGIE LUCEY YAGUARA SEGURA", emailGoogle: "maryiiyaguara0112@gmail.com" },
  { id: "1076500073", name: "ANDRES CAMILO GIL ALMEIDA", emailGoogle: "anmajilpa@gmail.com" },
  { id: "1076502460", name: "MARIA DE LOS ANGELES CASTRO TRUJILLO", emailGoogle: "teuluhiyokaseuteulocheonsauima@gmail.com" },
  { id: "1077228821", name: "CARLOS ANDRES MOJICA CRUZ", emailGoogle: "carlosandresmojicacruz@gmail.com" },
  { id: "1077721875", name: "ANA MARIA ALMARIO HURTADO", emailGoogle: "aalmariohurt2005@gmail.com" },
  { id: "1077724258", name: "ANGIE CAROLINA UNI GARZON", emailGoogle: "angiecauni0405@gmail.com" },
  { id: "1083839024", name: "MARIA CAMILA CUBILLOS AVILA", emailGoogle: "camilacubillosavila@gmail.com" },
  { id: "1121718462", name: "JHON JAIME ANDRES SAPUYES GASCA", emailGoogle: "gascaandrey505@gmail.com" },
  { id: "1127072071", name: "SAIRA FERNANDA OSPINA CHÁVEZ", emailGoogle: "ospinachavezsairafernanda@gmail.com" },
  { id: "36312241", name: "LUISA FERNANDA SUAREZ PERDOMO", emailGoogle: "luisafernandasuarezp@gmail.com" },
  { id: "1025324973", name: "DANA MONTES CARREÑO", emailGoogle: "dannamontes956@gmail.com" },
  { id: "1076907896", name: "JOHAN ESTEBAN LOPEZ MUÑOZ", emailGoogle: "johanestebanlopezmunoz@gmail.com" },
  { id: "1077231449", name: "LUIS MIGUEL POLOCHE DIAZ", emailGoogle: "secundariamiguel1234@gmail.com" }
];

async function seed() {
  console.log("Autenticando en Firebase...");
  await signInAnonymously(auth);
  console.log(`Iniciando registro masivo de ${aprendices.length} Aprendices en Firestore...`);
  
  for (const user of aprendices) {
    const userDoc = {
      id: user.id,
      name: user.name,
      role: "USUARIO-MEDIALAB",
      category: "APRENDIZ",
      emailGoogle: user.emailGoogle,
      email: user.emailGoogle
    };
    try {
      await setDoc(doc(db, "users", user.id), userDoc, { merge: true });
      console.log(`✅ [OK] Registrado: ${user.id} - ${user.name}`);
    } catch (err) {
      console.error(`❌ [ERROR] Falló ${user.id}:`, err);
    }
  }
  console.log("🚀 Registro completado exitosamente.");
  process.exit(0);
}

seed();
