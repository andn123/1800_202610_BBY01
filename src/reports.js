import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseConfig.js";

// Convert image to Base64 and store temporarily
export function setupImageUpload() {
  const input = document.getElementById("inputImage");

  if (!input) return;

  input.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (e) => {
      const base64String = e.target.result.split(",")[1];
      localStorage.setItem("inputImage", base64String);
      console.log("Image saved to localStorage");
    };

    reader.readAsDataURL(file);
  });
}

// Save report to Firestore
export async function submitReport(
  location,
  address,
  crowdLevel,
  lat,
  lng,
  monitorPointId,
) {
  const user = auth.currentUser;

  if (!user) {
    console.log("No user logged in");
    return;
  }

  const imageBase64 = localStorage.getItem("inputImage") || "";
  const userName = user.displayName || user.email;

  try {
    const docRef = await addDoc(collection(db, "reports"), {
      userId: user.uid,
      name: userName,

      monitorPointId,
      location,
      address,

      lat,
      lng,

      crowdLevel,
      image: imageBase64,
      createdAt: serverTimestamp(),
    });

    console.log("Report submitted:", docRef.id);

    localStorage.removeItem("inputImage");
  } catch (error) {
    console.error("Error submitting report:", error);
  }
}
