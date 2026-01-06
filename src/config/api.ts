import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// L'URL de Render
const API_URL = 'https://horizon-api-y8nb.onrender.com';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// --- INTERCEPTOR DE SÉCURITÉ ---
// Avant chaque requête, on regarde si on a un token et on l'ajoute
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Gestion des erreurs (ex: Token expiré)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Si on se fait rejeter (401), on supprime le token pour forcer la reco
      await AsyncStorage.removeItem('access_token');
    }
    return Promise.reject(error);
  }
);