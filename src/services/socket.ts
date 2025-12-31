import { io, Socket } from 'socket.io-client';
import { api } from '../config/api';

let socket: Socket | null = null;

export const connectSocket = () => {
  // On nettoie l'URL pour être sûr (pas de slash à la fin)
  const baseUrl = api.defaults.baseURL?.replace(/\/$/, '') || '';
  
  if (!socket) {
    console.log("🔌 Connexion WebSocket vers:", baseUrl);
    
    socket = io(baseUrl, {
      // ⚠️ CRUCIAL POUR REACT NATIVE :
      transports: ['websocket'], // On force WebSocket direct (pas de polling)
      autoConnect: true,
      reconnection: true,        // Réessayer si ça coupe
      reconnectionAttempts: 5,   // Max 5 essais
      reconnectionDelay: 1000,   // Attendre 1s entre les essais
      forceNew: true,            // Force une nouvelle connexion propre
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket Connecté ! ID:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket Déconnecté. Raison:', reason);
    });

    socket.on('connect_error', (err) => {
      // On log l'erreur pour comprendre (mais on ne crash pas l'app)
      console.log('⚠️ Erreur WebSocket (Détail):', err.message);
    });
  }
  
  // Si le socket existe mais est déconnecté, on le relance
  if (socket && !socket.connected) {
    socket.connect();
  }

  return socket;
};

export const sendPosition = (tourId: string, lat: number, lng: number) => {
  if (socket && socket.connected) {
    // Petit log pour vérifier que ça part
    console.log(`📡 Emit sendPosition: ${lat}, ${lng}`);
    socket.emit('sendPosition', { tourId, lat, lng });
  } else {
    console.log("⚠️ Impossible d'envoyer la position : Socket déconnecté");
  }
};

export const sendCollectionUpdate = (tourId: string, clientId: string, status: string) => {
  if (socket && socket.connected) {
    socket.emit('updateCollectionStatus', { tourId, clientId, status });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    // On ne met pas socket à null ici pour garder l'instance en mémoire 
    // et éviter de recréer des listeners en boucle si on revient sur l'écran
  }
};