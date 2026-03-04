import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, Alert, Linking, Platform, Dimensions } from 'react-native';
import { Appbar, Card, Text, Button, IconButton, ActivityIndicator, Portal, Dialog, RadioButton, ProgressBar, Surface, Avatar } from 'react-native-paper';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps'; // Ajout de Callout
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';
import { connectSocket, disconnectSocket, sendPosition, sendCollectionUpdate } from '../services/socket';

export default function TourExecutionScreen({ tour, onBack }: any) {
  const mapRef = useRef<MapView>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);

  const [isStarted, setIsStarted] = useState(tour.status === 'IN_PROGRESS');
  const [isFinishing, setIsFinishing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const [failModalVisible, setFailModalVisible] = useState(false);
  const [selectedClientForFail, setSelectedClientForFail] = useState<any>(null);
  const [failReason, setFailReason] = useState('CLIENT_ABSENT');

  const completedCount = clients.filter(c => c.status === 'COMPLETED' || c.status === 'FAILED').length;
  const totalCount = clients.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  // 1. GESTION NAVIGATION GPS DIRECTE (LANCE L'ITINÉRAIRE)
  const startNavigation = (lat: number, lng: number) => {
    const scheme = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`, // daddr lance l'itinéraire sur iOS
      android: `google.navigation:q=${lat},${lng}`, // google.navigation lance l'itinéraire sur Android
    });

    const url = scheme || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir l'application de navigation.");
      }
    });
  };

  useEffect(() => {
    initAll();
    connectSocket();
    return () => disconnectSocket();
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    const setupLocationTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          setCurrentLocation(loc.coords);
          if (isStarted) {
            sendPosition(tour.id, loc.coords.latitude, loc.coords.longitude);
            fetchRoute(loc.coords, clients);
          }
        }
      );
    };
    setupLocationTracking();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, [isStarted]);

  const initAll = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setCurrentLocation(loc.coords);
      }
      await loadClients();
    } catch (e) { console.error(e); }
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/tour-clients/tour/${tour.id}`);
      const data = response.data;
      setClients(data);
      await fetchRoute(currentLocation, data);
    } catch (error) {
      Alert.alert("Erreur", "Chargement impossible");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoute = async (startPos: any, clientList: any[]) => {
    const pending = clientList.filter(c => c.status !== 'COMPLETED' && c.status !== 'FAILED');
    if (pending.length === 0) { setRouteCoordinates([]); return; }
    const points = [];
    if (isStarted && startPos) points.push({ latitude: startPos.latitude, longitude: startPos.longitude });
    points.push(...pending.map(c => ({
      latitude: c.client.location.coordinates[1],
      longitude: c.client.location.coordinates[0],
    })));
    if (points.length < 2) return;
    try {
      const coordsStr = points.map(p => `${p.longitude},${p.latitude}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.length > 0) {
        setRouteCoordinates(data.routes[0].geometry.coordinates.map((c: any) => ({
          latitude: c[1], longitude: c[0]
        })));
      }
    } catch (e) { console.log("Routing error", e); }
  };

  const handleAction = async (client: any, status: 'COMPLETED' | 'FAILED', reason?: string) => {
    if (processingIds.has(client.id)) return;
    setProcessingIds(prev => new Set(prev).add(client.id));
    const updated = clients.map(c => c.clientId === client.id ? { ...c, status } : c);
    setClients(updated);
    try {
      await api.post('/collections', { tour_id: tour.id, client_id: client.id, status, reason_if_failed: reason });
      sendCollectionUpdate(tour.id, client.id, status);
      await fetchRoute(currentLocation, updated);
    } catch (e) { Alert.alert("Erreur", "Sera synchronisé plus tard."); } 
    finally { setProcessingIds(prev => { const n = new Set(prev); n.delete(client.id); return n; }); }
  };

  const renderClientItem = ({ item, index }: any) => {
    const c = item.client;
    const isDone = item.status === 'COMPLETED';
    const isFailed = item.status === 'FAILED';
    const isNext = !isDone && !isFailed && clients.find(cl => cl.status !== 'COMPLETED' && cl.status !== 'FAILED')?.clientId === item.clientId;
    const lat = c.location?.coordinates[1];
    const lng = c.location?.coordinates[0];

    return (
      <Card style={[styles.clientCard, isNext && styles.nextClientCard, isDone && styles.doneCard, isFailed && styles.failedCard]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardMain}>
            <Avatar.Text size={36} label={(index + 1).toString()} style={{ backgroundColor: isDone ? '#40C057' : isFailed ? '#FA5252' : isNext ? '#228BE6' : '#CED4DA' }} />
            <View style={styles.clientInfo}>
              <Text style={[styles.nameText, (isDone || isFailed) && { textDecorationLine: 'line-through', color: '#ADB5BD' }]}>{c.name}</Text>
              <Text style={{ color: '#666', fontSize: 12 }}>{c.street_address}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            {!(isDone || isFailed) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton 
                    icon="google-maps" 
                    mode="contained-tonal" 
                    containerColor="#E7F5FF" 
                    iconColor="#228BE6" 
                    onPress={() => startNavigation(lat, lng)} // <--- NAVIGATION DIRECTE
                />
                <IconButton icon="close-circle" mode="contained" containerColor="#FFF5F5" iconColor="#FA5252" onPress={() => { setSelectedClientForFail(c); setFailModalVisible(true); }} />
                <Button mode="contained" buttonColor="#40C057" onPress={() => handleAction(c, 'COMPLETED')} loading={processingIds.has(c.id)}>FAIT</Button>
              </View>
            ) : (
              <View style={styles.statusBadge}>
                <Text style={{ color: isDone ? '#2B8A3E' : '#C92A2A', fontWeight: 'bold', fontSize: 12 }}>{isDone ? 'COLLECTÉ' : 'RATÉ'}</Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated style={{ backgroundColor: '#fff' }}>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title={tour.name} titleStyle={{ fontSize: 18, fontWeight: 'bold' }} />
        {isStarted && (
          <Button mode="text" textColor="green" onPress={() => {
            Alert.alert("Terminer ?", "Clôturer la tournée ?", [
              { text: "Non" }, { text: "Oui", onPress: async () => {
                await api.patch(`/tours/${tour.id}`, { status: 'COMPLETED' });
                onBack();
              }}
            ]);
          }}>FINIR</Button>
        )}
      </Appbar.Header>

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation
          initialRegion={{
            latitude: currentLocation?.latitude || -1.6585,
            longitude: currentLocation?.longitude || 29.2205,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          <Polyline coordinates={routeCoordinates} strokeColor="#228BE6" strokeWidth={5} />
          {/* LES MARQUEURS DES CLIENTS */}
          {clients.map((item, idx) => {
            const c = item.client;
            const coords = c.location?.coordinates;
  if (!coords) return null;

            const isDone = item.status === 'COMPLETED';
            const isFailed = item.status === 'FAILED';
  return (
    <Marker 
      key={item.clientId} 
      coordinate={{ latitude: coords[1], longitude: coords[0] }}
      // --- SOLUTION NATIVE : SIMPLE ET ROBUSTE ---
      title={c.name} // Affiche le nom dans la bulle système
      description={c.street_address} // Affiche l'adresse en petit dessous
      // -------------------------------------------
      pinColor={isDone ? 'green' : isFailed ? 'orange' : 'red'}
    />
  );
})}
        </MapView>
        
        <Surface style={styles.progressCard} elevation={2}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ fontWeight: 'bold' }}>Progression</Text>
            <Text style={{ color: '#666' }}>{completedCount}/{totalCount}</Text>
          </View>
          <ProgressBar progress={progress} color="#40C057" style={{ height: 8, borderRadius: 4 }} />
        </Surface>
      </View>

      <View style={styles.listWrapper}>
        {!isStarted ? (
          <View style={styles.startOverlay}>
            <Avatar.Icon size={64} icon="play-circle" style={{ backgroundColor: '#E7F5FF' }} color="#228BE6" />
            <Text style={{ marginVertical: 15, fontSize: 20, fontWeight: 'bold' }}>Tournée prête</Text>
            <Button mode="contained" style={styles.bigButton} onPress={async () => {
              await api.patch(`/tours/${tour.id}`, { status: 'IN_PROGRESS' });
              setIsStarted(true);
            }}>DÉMARRER LA MISSION</Button>
          </View>
        ) : (
          <FlatList data={clients} renderItem={renderClientItem} keyExtractor={item => item.clientId} contentContainerStyle={{ padding: 12, paddingBottom: 40 }} />
        )}
      </View>

      <Portal>
        <Dialog visible={failModalVisible} onDismiss={() => setFailModalVisible(false)}>
          <Dialog.Title>Signalement d'échec</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group onValueChange={v => setFailReason(v)} value={failReason}>
              <RadioButton.Item label="Client absent" value="CLIENT_ABSENT" />
              <RadioButton.Item label="Accès impossible" value="ACCESS_DENIED" />
              <RadioButton.Item label="Déchets non conformes" value="NON_COMPLIANT_WASTE" />
              <RadioButton.Item label="Autre" value="OTHER" />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFailModalVisible(false)}>Annuler</Button>
            <Button onPress={() => { handleAction(selectedClientForFail, 'FAILED', failReason); setFailModalVisible(false); }}>Confirmer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  mapWrapper: { height: Dimensions.get('window').height * 0.35, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  calloutContainer: { padding: 8, borderRadius: 8, backgroundColor: '#fff', width: 180 },
  progressCard: { position: 'absolute', bottom: 15, left: 15, right: 15, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)' },
  listWrapper: { flex: 1 },
  clientCard: { marginBottom: 10, borderRadius: 12, backgroundColor: '#fff' },
  nextClientCard: { borderColor: '#228BE6', borderLeftWidth: 6 },
  doneCard: { backgroundColor: '#F8F9FA', opacity: 0.8 },
  failedCard: { backgroundColor: '#FFF5F5' },
  cardContent: { padding: 12 },
  cardMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  clientInfo: { marginLeft: 12, flex: 1 },
  nameText: { fontWeight: 'bold' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#f0f0f0' },
  startOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  bigButton: { width: '100%', borderRadius: 8 },
});