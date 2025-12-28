import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../config/api';
// Imports WebSocket
import { connectSocket, disconnectSocket, sendPosition, sendCollectionUpdate } from '../services/socket';

export default function TourExecutionScreen({ tour, onBack }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isStarted, setIsStarted] = useState(tour.status === 'IN_PROGRESS');

  // 1. Initialisation (Chargement + WebSocket + GPS)
  useEffect(() => {
    loadClients();
    
    // Connexion au canal radio (WebSocket)
    connectSocket();

    // Gestion du GPS en temps réel
    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission refusée", "La géolocalisation est nécessaire pour le suivi.");
        return;
      }

      // On récupère la position initiale
      let initialLocation = await Location.getCurrentPositionAsync({});
      setCurrentLocation(initialLocation.coords);

      // On s'abonne aux changements de position (Tracking)
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Envoi toutes les 10 secondes
          distanceInterval: 50, // Ou tous les 50 mètres
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation(location.coords); // Mise à jour locale (Carte)

          // 📡 ENVOI AU BACKEND (WebSocket)
          console.log("📡 Envoi position...", latitude, longitude);
          sendPosition(tour.id, latitude, longitude);
        }
      );
    };

    if (isStarted) {
      startTracking();
    }

    // Nettoyage en quittant l'écran
    return () => {
      if (locationSubscription) locationSubscription.remove();
      disconnectSocket();
    };
  }, [isStarted, tour.id]); // Se relance si la tournée démarre

  const loadClients = async () => {
    try {
      const response = await api.get(`/tour-clients/tour/${tour.id}`);
      setClients(response.data);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les clients");
    } finally {
      setLoading(false);
    }
  };

  // 2. Démarrer la tournée
  const handleStartTour = async () => {
    try {
      await api.patch(`/tours/${tour.id}`, { status: 'IN_PROGRESS' });
      setIsStarted(true);
      Alert.alert("C'est parti !", "Le suivi GPS est activé.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de démarrer la tournée");
    }
  };

  // 3. Valider une collecte (CORRIGÉ)
  const handleValidate = (client: any) => {
    if (!isStarted) {
      Alert.alert("Attente", "Veuillez d'abord cliquer sur DÉMARRER LA TOURNÉE");
      return;
    }
    
    // 📡 ENVOI AU BACKEND (WebSocket)
    sendCollectionUpdate(tour.id, client.id, 'COMPLETED');
    
    // Feedback visuel immédiat (Optionnel : on pourrait attendre la réponse du socket)
    Alert.alert("Succès", `Collecte validée pour ${client.name} ! ✅`);
    
    // Pour une meilleure UX, on pourrait aussi mettre à jour la liste locale ici
    // pour passer la ligne en vert immédiatement sans recharger.
  };

  const renderClient = ({ item, index }: any) => {
    const client = item.client;
    
    return (
      <Card style={[styles.card, index === 0 ? styles.activeCard : null]}>
        <Card.Title 
          title={`${index + 1}. ${client.name}`} 
          subtitle={client.street_address}
          left={(props) => <IconButton {...props} icon="map-marker" />}
          right={(props) => (
            <IconButton 
                {...props} 
                icon="check-circle" 
                iconColor="green" 
                size={30} 
                // CORRECTION ICI : On passe l'objet 'client' entier, pas juste le nom
                onPress={() => handleValidate(client)} 
            />
          )}
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title={tour.name} subtitle={isStarted ? "🟢 En cours - Suivi actif" : "⚪ Non démarrée"} />
      </Appbar.Header>

      {/* --- LA CARTE --- */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: currentLocation?.latitude || -1.6585,
            longitude: currentLocation?.longitude || 29.2205,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={true}
        >
          {/* Marqueurs des clients */}
          {clients.map((item, index) => {
             const c = item.client;
             // Vérification stricte des coordonnées
             if(c.location && c.location.coordinates && Array.isArray(c.location.coordinates)) {
                 return (
                    <Marker 
                        key={c.id}
                        coordinate={{
                            latitude: c.location.coordinates[0], 
                            longitude: c.location.coordinates[1]
                        }}
                        title={`${index+1}. ${c.name}`}
                    />
                 )
             }
             return null;
          })}
        </MapView>
      </View>

      {/* --- LA LISTE --- */}
      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator style={{marginTop: 20}} />
        ) : (
          <>
            {!isStarted && (
                <Button mode="contained" icon="play" style={{margin: 10}} onPress={handleStartTour}>
                    DÉMARRER LA TOURNÉE
                </Button>
            )}
            <FlatList
              data={clients}
              renderItem={renderClient}
              keyExtractor={(item) => item.clientId}
              contentContainerStyle={{paddingBottom: 20}}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  mapContainer: { height: '40%', width: '100%' },
  map: { width: '100%', height: '100%' },
  listContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginHorizontal: 10, marginTop: 10, backgroundColor: 'white' },
  activeCard: { borderLeftWidth: 5, borderLeftColor: '#2196F3' }
});