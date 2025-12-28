import { io, Socket } from 'socket.io-client';
import { api } from '../config/api'; // Pour récupérer l'URL de base

let socket: Socket | null = null;

// Initialiser la connexion
export const connectSocket = () => {
  // On récupère l'URL de l'API (ex: http://192.168.x.x:3000 ou Render)
  // On enlève juste le '/api' si besoin, mais Socket.io gère ça.
  // Attention: Socket.io a besoin de l'URL racine (sans le path)
  const baseUrl = api.defaults.baseURL || '';
  
  if (!socket) {
    console.log("🔌 Tentative de connexion WebSocket vers:", baseUrl);
    
    socket = io(baseUrl, {
      transports: ['websocket'], // Force le mode websocket pour la performance
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket Connecté ! ID:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket Déconnecté');
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ Erreur WebSocket:', err.message);
    });
  }
  return socket;
};

// Envoyer la position GPS
export const sendPosition = (tourId: string, lat: number, lng: number) => {
  if (socket && socket.connected) {
    socket.emit('sendPosition', { tourId, lat, lng });
  }
};

// Envoyer une mise à jour de collecte
export const sendCollectionUpdate = (tourId: string, clientId: string, status: string) => {
  if (socket && socket.connected) {
    socket.emit('updateCollectionStatus', { tourId, clientId, status });
  }
};

// Se déconnecter proprement
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};