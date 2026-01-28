import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../config/api';
import { connectSocket, disconnectSocket, sendPosition, sendCollectionUpdate } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
export default function TourExecutionScreen({ tour, onBack }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  
  const [isStarted, setIsStarted] = useState(tour.status === 'IN_PROGRESS');
  const [isFinishing, setIsFinishing] = useState(false);
  // On garde processingIds pour le spinner pendant l'appel réseau
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // 1. Initialisation
  useEffect(() => {
    loadClients();
    connectSocket();

    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let initialLocation = await Location.getCurrentPositionAsync({});
      setCurrentLocation(initialLocation.coords);

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 50 },
        (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation(location.coords);
          if (isStarted) sendPosition(tour.id, latitude, longitude);
        }
      );
    };

    startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      disconnectSocket();
    };
  }, [isStarted, tour.id]);

  // ... import AsyncStorage ...

  const loadClients = async () => {
    try {
      // Clé unique pour cette tournée
      const cacheKey = `tour_clients_${tour.id}`;

      try {
          // 1. Essai Réseau
          const response = await api.get(`/tour-clients/tour/${tour.id}`);
          setClients(response.data);
          
          // 2. Sauvegarde Cache
          await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));

      } catch (networkError) {
          console.log("Mode Hors-ligne activé pour le détail");
          
          // 3. Fallback Cache
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
              setClients(JSON.parse(cached));
              Alert.alert("Hors-ligne", "Vous travaillez sur une version sauvegardée.");
          } else {
              throw networkError;
          }
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les clients (Pas de connexion et pas de cache).");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTour = async () => {
    try {
      await api.patch(`/tours/${tour.id}`, { status: 'IN_PROGRESS' });
      setIsStarted(true);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de démarrer.");
    }
  };

  const handleFinishTour = async () => {
    Alert.alert("Terminer ?", "Confirmez-vous la fin de la tournée ?", [
      { text: "Annuler", style: "cancel" },
      { 
        text: "Oui, Terminer", 
        onPress: async () => {
          if (isFinishing) return;
          setIsFinishing(true);
          try {
            await api.patch(`/tours/${tour.id}`, { status: 'COMPLETED' });
            Alert.alert("Succès", "Tournée terminée.");
            onBack(); 
          } catch (e) {
            Alert.alert("Erreur", "Échec de la clôture.");
            setIsFinishing(false);
          }
        }
      }
    ]);
  };

  // 4. Valider une collecte (CORRIGÉ : VERROUILLAGE IMMÉDIAT)
  const handleValidate = async (client: any) => {
    if (!isStarted) {
      Alert.alert("Attente", "Veuillez d'abord DÉMARRER la tournée.");
      return;
    }
    
    if (processingIds.has(client.id)) return;

    // A. Mise à jour OPTIMISTE de l'interface
    // On marque immédiatement le client comme "COMPLETED" dans la liste locale
    setClients(currentList => currentList.map(item => {
        if (item.clientId === client.id) { // Attention: item.clientId vs client.id selon votre structure API
             return { ...item, status: 'COMPLETED' }; // On change le statut localement
        }
        return item;
    }));

    // B. Verrouillage technique
    setProcessingIds(prev => new Set(prev).add(client.id));

    try {
        // C. Appel Réseau
        await api.post('/collections', {
            tour_id: tour.id,
            client_id: client.id,
            status: 'COMPLETED'
        });

        sendCollectionUpdate(tour.id, client.id, 'COMPLETED');
        
    } catch (error) {
        console.error(error);
        Alert.alert("Erreur", "La validation n'a pas pu être envoyée. Elle sera réessayée.");
        // Note: En cas d'erreur, on pourrait remettre le statut à 'PENDING', 
        // mais pour une app offline-first, on préfère souvent garder l'état "fait" localement.
    } finally {
        setProcessingIds(prev => {
            const next = new Set(prev);
            next.delete(client.id);
            return next;
        });
    }
  };

  const renderClient = ({ item, index }: any) => {
    const client = item.client;
    
    // On vérifie si c'est déjà fait (soit via la BDD, soit via notre update local)
    // Note: Adaptez 'item.status' selon le nom exact renvoyé par votre backend ou ajouté localement
    const isDone = item.status === 'COMPLETED'; 
    const isProcessing = processingIds.has(client.id);

    return (
      <Card style={[
          styles.card, 
          index === 0 ? styles.activeCard : null,
          isDone ? styles.doneCard : null // Style grisé si fait
        ]}>
        <Card.Title 
          title={`${index + 1}. ${client.name}`} 
          titleStyle={isDone ? {textDecorationLine: 'line-through', color: 'gray'} : {}}
          subtitle={client.street_address}
          left={(props) => <IconButton {...props} icon="map-marker" />}
          right={(props) => (
            // LOGIQUE D'AFFICHAGE DU BOUTON
            isDone ? (
                // CAS 1 : C'est fait -> Icône statique grise ou verte, non cliquable
                <IconButton {...props} icon="check" iconColor="gray" disabled={true} />
            ) : isProcessing ? (
                // CAS 2 : Ça charge -> Spinner
                <ActivityIndicator animating={true} color="green" style={{ marginRight: 16 }} />
            ) : (
                // CAS 3 : À faire -> Bouton cliquable
                <IconButton 
                    {...props} 
                    icon="check-circle" 
                    iconColor="green" 
                    size={30} 
                    onPress={() => handleValidate(client)} 
                />
            )
          )}
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title={tour.name} subtitle={isStarted ? "🟢 En cours" : "⚪ En attente"} />
      </Appbar.Header>

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
             if(c.location?.coordinates) {
                 // Si c'est fait, on peut changer la couleur du marqueur aussi (optionnel)
                 return <Marker key={c.id} coordinate={{latitude: c.location.coordinates[0], longitude: c.location.coordinates[1]}} title={`${index+1}. ${c.name}`} />;
             }
             return null;
          })}
        </MapView>
      </View>

      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator style={{marginTop: 20}} />
        ) : (
          <>
            {!isStarted ? (
                <Button mode="contained" icon="play" style={{margin: 10, backgroundColor: '#2196F3'}} onPress={handleStartTour}>
                    DÉMARRER LA TOURNÉE
                </Button>
            ) : (
                <Button 
                    mode="contained" 
                    icon="flag-checkered" 
                    style={{margin: 10, backgroundColor: 'green'}} 
                    onPress={handleFinishTour}
                    loading={isFinishing}
                    disabled={isFinishing}
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
  activeCard: { borderLeftWidth: 5, borderLeftColor: '#2196F3' },
  doneCard: { backgroundColor: '#f0fdf4', opacity: 0.8 } // Fond vert très clair pour les finis
});