import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Appbar, Card, Text, Badge, Button, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function HomeScreen({ onLogout, onSelectTour }: any) {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Charger le nom de l'équipe et les tournées
  const loadData = async () => {
    // ...
      const response = await api.get('/tours');
      
      // MODIFICATION : On affiche TOUT si on est admin (pour tester)
      const myTours = response.data.filter((t: any) => 
        ['PLANNED', 'IN_PROGRESS'].includes(t.status)
      );
      // ...
    try {
      const name = await AsyncStorage.getItem('team_name');
      const teamId = await AsyncStorage.getItem('team_id');
      setTeamName(name || '');

      // Récupérer TOUTES les tournées
      const response = await api.get('/tours');
      
      // Filtrer côté client pour le MVP (Idéalement, filtrer côté serveur)
      // On garde les tournées de MON équipe qui sont PLANIFIÉES ou EN COURS
      const myTours = response.data.filter((t: any) => 
        (t.team?.id === teamId || t.team_id === teamId) && 
        ['PLANNED', 'IN_PROGRESS'].includes(t.status)
      );

      setTours(myTours);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderTour = ({ item }: { item: any }) => (
    <Card style={styles.card} mode="elevated">
      <Card.Title 
        title={item.name} 
        subtitle={item.tour_date}
        left={(props) => <Badge size={24} style={{backgroundColor: item.status === 'IN_PROGRESS' ? 'orange' : '#2196F3'}}>{item.status === 'IN_PROGRESS' ? 'GO' : '⏱️'}</Badge>}
      />
      <Card.Content>
        <Text variant="bodyMedium">Véhicule : {item.vehicle?.name}</Text>
      </Card.Content>
      <Card.Actions>
        <Button mode="contained" onPress={() => onSelectTour(item)}>
          {item.status === 'IN_PROGRESS' ? 'CONTINUER' : 'DÉMARRER'}
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.Content title="Mes Tournées" subtitle={`Équipe : ${teamName}`} />
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={tours}
          renderItem={renderTour}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>Aucune tournée planifiée pour le moment.</Text>
              <Button onPress={onRefresh} style={{marginTop: 20}}>Actualiser</Button>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  card: { marginBottom: 16, backgroundColor: 'white' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
});