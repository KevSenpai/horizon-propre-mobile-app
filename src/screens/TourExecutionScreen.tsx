import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../config/api';
import { connectSocket, disconnectSocket, sendPosition, sendCollectionUpdate } from '../services/socket';

export default function TourExecutionScreen({ tour, onBack }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  
  // État local pour savoir si la tournée est active
  const [isStarted, setIsStarted] = useState(tour.status === 'IN_PROGRESS');

  // 1. Initialisation (Chargement + WebSocket + GPS)
  useEffect(() => {
    loadClients();
    
    // Connexion WebSocket
    connectSocket();

    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission refusée", "La géolocalisation est nécessaire.");
        return;
      }

      // Position initiale
      let initialLocation = await Location.getCurrentPositionAsync({});
      setCurrentLocation(initialLocation.coords);

      // Tracking temps réel
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 secondes
          distanceInterval: 50, // 50 mètres
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation(location.coords);

          // 📡 ENVOI SOCKET SI TOURNÉE DÉMARRÉE
          if (isStarted) {
             console.log("📡 Envoi position...", latitude, longitude);
             sendPosition(tour.id, latitude, longitude);
          }
        }
      );
    };

    startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      disconnectSocket();
    };
  }, [isStarted, tour.id]);

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

  // 2. Action : Démarrer la tournée
  const handleStartTour = async () => {
    try {
      await api.patch(`/tours/${tour.id}`, { status: 'IN_PROGRESS' });
      setIsStarted(true);
      Alert.alert("C'est parti !", "Le suivi GPS est activé.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de démarrer la tournée");
    }
  };

  // 3. Action : Terminer la tournée (LA CORRECTION EST ICI)
  const handleFinishTour = async () => {
    Alert.alert(
      "Terminer la tournée ?",
      "Confirmez-vous la fin de la tournée ? Cette action clôturera la mission.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Oui, Terminer", 
          onPress: async () => {
            try {
              // Appel API pour passer en COMPLETED
              await api.patch(`/tours/${tour.id}`, { status: 'COMPLETED' });
              
              Alert.alert("Félicitations ! 🎉", "Tournée terminée avec succès.");
              
              // Retour à la liste (qui ne l'affichera plus car elle est finie)
              onBack(); 
            } catch (e) {
              console.error(e);
              Alert.alert("Erreur", "Impossible de terminer la tournée. Vérifiez la connexion.");
            }
          }
        }
      ]
    );
  };

  // 4. Action : Valider une collecte
  // 4. Action : Valider une collecte (CORRIGÉE ET PERSISTANTE)
  const handleValidate = async (client: any) => {
    if (!isStarted) {
      Alert.alert("Attente", "Veuillez d'abord cliquer sur DÉMARRER LA TOURNÉE");
      return;
    }
    
    try {
        // 1. SAUVEGARDE EN BASE DE DONNÉES (L'étape qui manquait !)
        await api.post('/collections', {
            tour_id: tour.id,
            client_id: client.id,
            status: 'COMPLETED'
        });

        // 2. Envoi WebSocket (Pour l'effet visuel immédiat sur le Web)
        sendCollectionUpdate(tour.id, client.id, 'COMPLETED');
        
        Alert.alert("Succès", `Collecte validée pour ${client.name}`);

    } catch (error) {
        console.error(error);
        // Même si ça échoue (ex: pas de réseau), on pourrait le stocker en local (SQLite)
        // Pour le MVP connecté, on affiche une alerte.
        Alert.alert("Attention", "La sauvegarde a échoué. Vérifiez votre connexion.");
    }
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
        <Appbar.Content 
            title={tour.name} 
            subtitle={isStarted ? "🟢 En cours" : "⚪ En attente"} 
            subtitleStyle={{ color: isStarted ? 'green' : 'grey' }}
        />
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
          {clients.map((item, index) => {
             const c = item.client;
             if(c.location && c.location.coordinates) {
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

      {/* --- LA LISTE ET LES ACTIONS --- */}
      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator style={{marginTop: 20}} />
        ) : (
          <>
            {/* BOUTON DYNAMIQUE : DÉMARRER OU TERMINER */}
            {!isStarted ? (
                <Button 
                    mode="contained" 
                    icon="play" 
                    style={{margin: 10, backgroundColor: '#2196F3'}} 
                    onPress={handleStartTour}
                >
                    DÉMARRER LA TOURNÉE
                </Button>
            ) : (
                <Button 
                    mode="contained" 
                    icon="flag-checkered" 
                    style={{margin: 10, backgroundColor: 'green'}} 
                    onPress={handleFinishTour}
                >
                    TERMINER LA TOURNÉE
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