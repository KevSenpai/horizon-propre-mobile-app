import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, Linking, Platform } from 'react-native';
import { Appbar, Card, Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import MapView, { Marker, Polyline } from 'react-native-maps'; // Ajout de Polyline
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';
import { connectSocket, disconnectSocket, sendPosition, sendCollectionUpdate } from '../services/socket';

export default function TourExecutionScreen({ tour, onBack }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]); // Pour le tracé bleu

  const [isStarted, setIsStarted] = useState(tour.status === 'IN_PROGRESS');
  const [isFinishing, setIsFinishing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

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

  const loadClients = async () => {
    try {
      const cacheKey = `tour_clients_${tour.id}`;
      let data = [];

      try {
        const response = await api.get(`/tour-clients/tour/${tour.id}`);
        data = response.data;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (networkError) {
        console.log("Offline mode for details");
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) data = JSON.parse(cached);
      }

      setClients(data);

      // Préparer les coordonnées pour la ligne bleue (Polyline)
      const coords = data
        .filter((item: any) => item.client.location && item.client.location.coordinates)
        .map((item: any) => ({
            // ATTENTION : GeoJSON est [Long, Lat], MapView veut {latitude, longitude}
            latitude: item.client.location.coordinates[1],
            longitude: item.client.location.coordinates[0],
        }));
      setRouteCoordinates(coords);

    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les clients");
    } finally {
      setLoading(false);
    }
  };

  // --- NOUVELLE FONCTION : OUVRIR GOOGLE MAPS ---
  const openMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) {
        Linking.openURL(url);
    }
  };

  const handleStartTour = async () => {
    try {
      await api.patch(`/tours/${tour.id}`, { status: 'IN_PROGRESS' });
      setIsStarted(true);
    } catch (e) { Alert.alert("Erreur", "Impossible de démarrer."); }
  };

  const handleFinishTour = async () => {
    Alert.alert("Terminer ?", "Confirmer la fin ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Oui", onPress: async () => {
          if (isFinishing) return;
          setIsFinishing(true);
          try {
            await api.patch(`/tours/${tour.id}`, { status: 'COMPLETED' });
            onBack(); 
          } catch (e) { setIsFinishing(false); }
        }
      }
    ]);
  };

  const handleValidate = async (client: any) => {
    if (!isStarted) {
      Alert.alert("Attente", "Veuillez d'abord DÉMARRER la tournée.");
      return;
    }
    if (processingIds.has(client.id)) return;

    setClients(prev => prev.map(item => item.clientId === client.id ? { ...item, status: 'COMPLETED' } : item));
    setProcessingIds(prev => new Set(prev).add(client.id));

    try {
        await api.post('/collections', { tour_id: tour.id, client_id: client.id, status: 'COMPLETED' });
        sendCollectionUpdate(tour.id, client.id, 'COMPLETED');
    } catch (error) { console.error(error); } 
    finally {
        setProcessingIds(prev => { const n = new Set(prev); n.delete(client.id); return n; });
    }
  };

  const renderClient = ({ item, index }: any) => {
    const client = item.client;
    const isDone = item.status === 'COMPLETED'; 
    const isProcessing = processingIds.has(client.id);
    
    // Récupération sécurisée des coordonnées
    const hasGPS = client.location && client.location.coordinates;
    const lat = hasGPS ? client.location.coordinates[1] : null;
    const lng = hasGPS ? client.location.coordinates[0] : null;

    return (
      <Card style={[styles.card, isDone ? styles.doneCard : null]}>
        <Card.Title 
          title={`${index + 1}. ${client.name}`} 
          titleStyle={isDone ? {textDecorationLine: 'line-through', color: 'gray'} : {}}
          subtitle={client.street_address}
          // --- CORRECTION : BOUTON MAPS À GAUCHE ---
          left={(props) => (
             hasGPS ? (
                <IconButton {...props} icon="google-maps" iconColor="#4285F4" onPress={() => openMaps(lat, lng, client.name)} />
             ) : (
                <IconButton {...props} icon="map-marker-off" iconColor="gray" />
             )
          )}
          right={(props) => (
            isDone ? (
                <IconButton {...props} icon="check" iconColor="gray" disabled />
            ) : isProcessing ? (
                <ActivityIndicator animating color="green" style={{ marginRight: 16 }} />
            ) : (
                <IconButton {...props} icon="check-circle" iconColor="green" size={30} onPress={() => handleValidate(client)} />
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
            // On centre sur le premier client ou Goma par défaut
            latitude: routeCoordinates.length > 0 ? routeCoordinates[0].latitude : -1.6585,
            longitude: routeCoordinates.length > 0 ? routeCoordinates[0].longitude : 29.2205,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
        >
          {/* LIGNE BLEUE (ITINÉRAIRE) */}
          <Polyline coordinates={routeCoordinates} strokeColor="#2196F3" strokeWidth={4} />

          {/* MARQUEURS */}
          {clients.map((item, index) => {
             const c = item.client;
             if(c.location?.coordinates) {
                 // Inversion [1] = Lat, [0] = Lon pour Leaflet/GoogleMaps
                 return (
                    <Marker 
                        key={c.id} 
                        coordinate={{latitude: c.location.coordinates[1], longitude: c.location.coordinates[0]}} 
                        title={`${index+1}. ${c.name}`}
                        description={item.status === 'COMPLETED' ? "✅ Fait" : "À faire"}
                        pinColor={item.status === 'COMPLETED' ? 'green' : 'red'}
                    />
                 );
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
  mapContainer: { height: '45%', width: '100%' }, // J'ai agrandi un peu la carte
  map: { width: '100%', height: '100%' },
  listContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginHorizontal: 10, marginTop: 10, backgroundColor: 'white' },
  doneCard: { backgroundColor: '#f0fdf4', opacity: 0.8 }
});