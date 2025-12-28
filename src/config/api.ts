import axios from 'axios';

// L'adresse IPv4 de votre PC sur le partage de connexion
const API_URL = 'https://horizon-api-y8nb.onrender.com';  

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Intercepteur pour gérer les erreurs réseau simplement
api.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ERR_NETWORK') {
      console.error("Erreur Réseau: Impossible de joindre le serveur. Vérifiez l'IP et le Pare-feu.");
    }
    return Promise.reject(error);
  }
);