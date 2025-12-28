import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Button, IconButton, ActivityIndicator, FAB } from 'react-native-paper';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../config/api';

export default function TourExecutionScreen({ tour, onBack }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isStarted, setIsStarted] = useState(tour.status === 'IN_PROGRESS');

  // 1. Charger les clients et la position GPS
  useEffect(() => {
    loadClients();
    getCurrentLocation();
  }, []);

  const loadClients = async () => {
    try {
      // On récupère les clients de la tournée via l'API
      const response = await api.get(`/tour-clients/tour/${tour.id}`);
      setClients(response.data);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les clients");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);
    } catch (e) {
      console.log("Erreur GPS", e);
    }
  };

  // 2. Démarrer la tournée
  const handleStartTour = async () => {
    try {
      await api.patch(`/tours/${tour.id}`, { status: 'IN_PROGRESS' });
      setIsStarted(true);
      Alert.alert("C'est parti !", "Bonne route. Soyez prudents.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de démarrer la tournée");
    }
  };

  // 3. Valider une collecte (Simulé pour le moment)
  const handleValidate = (clientName: string) => {
    if (!isStarted) {
      Alert.alert("Attente", "Veuillez d'abord cliquer sur DÉMARRER LA TOURNÉE");
      return;
    }
    // Ici, on appellerait l'API 'Collections' (à faire plus tard)
    Alert.alert("Succès", `Collecte validée pour ${clientName} ! ✅`);
  };

  const renderClient = ({ item, index }: any) => {
    const client = item.client;
    // Récupération sécurisée des coordonnées
    const coords = client.location?.coordinates; 
    // Rappel : PostGIS peut renvoyer [lat, lng] ou [lng, lat]. Adaptez si besoin.
    
    return (
      <Card style={[styles.card, index === 0 ? styles.activeCard : null]}>
        <Card.Title 
          title={`${index + 1}. ${client.name}`} 
          subtitle={client.street_address}
          left={(props) => <IconButton {...props} icon="map-marker" />}
          right={(props) => (
            <IconButton {...props} icon="check-circle" iconColor="green" size={30} onPress={() => handleValidate(client.name)} />
          )}
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title={tour.name} subtitle={isStarted ? "En cours..." : "Non démarrée"} />
      </Appbar.Header>

      {/* --- LA CARTE --- */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: -1.6585, // Goma Centre
            longitude: 29.2205,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
        >
          {/* Marqueurs des clients */}
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
  container: { flex: 1 },
  mapContainer: { height: '40%', width: '100%' },
  map: { width: '100%', height: '100%' },
  listContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginHorizontal: 10, marginTop: 10, backgroundColor: 'white' },
  activeCard: { borderLeftWidth: 5, borderLeftColor: '#2196F3' }
});