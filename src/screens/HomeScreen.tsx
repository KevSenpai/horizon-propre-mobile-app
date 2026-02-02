import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Appbar, Card, Text, Badge, Button, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function HomeScreen({ onLogout, onSelectTour, onShowHistory }: any) {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Date d'aujourd'hui (Format YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      const name = await AsyncStorage.getItem('team_name');
      const teamId = await AsyncStorage.getItem('team_id');
      setTeamName(name || '');

      try {
          // 1. Tentative Réseau
          const response = await api.get('/tours');
          
          // Filtrage : Mes tournées + Statut Valide
          const myTours = response.data.filter((t: any) => 
            (t.team?.id === teamId || t.team_id === teamId) && 
            ['PLANNED', 'IN_PROGRESS'].includes(t.status)
          );
          
          // Tri : D'abord celles d'aujourd'hui, puis les futures
          myTours.sort((a: any, b: any) => a.tour_date.localeCompare(b.tour_date));
          
          setTours(myTours);
          
          // Mise en cache pour le mode hors-ligne
          await AsyncStorage.setItem('cached_tours', JSON.stringify(myTours));

      } catch (networkError: any) {
          console.log("Erreur réseau ou API:", networkError);

          // GESTION ERREUR 401 (Session expirée)
          if (networkError.response && networkError.response.status === 401) {
              Alert.alert("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.");
              onLogout(); // Déconnexion forcée
              return;
          }

          // GESTION MODE HORS-LIGNE (Si pas de réseau)
          const cached = await AsyncStorage.getItem('cached_tours');
          if (cached) {
              setTours(JSON.parse(cached));
              // Petit toast ou log pour dire qu'on est offline (optionnel)
          } else {
             // Si ni réseau ni cache, on ne peut rien faire
             Alert.alert("Connexion requise", "Impossible de charger les tournées et aucun cache disponible.");
          }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  
  const onRefresh = () => { 
      setRefreshing(true); 
      loadData(); 
  };

  const renderTour = ({ item }: { item: any }) => {
    // LOGIQUE DE RESTRICTION
    const isToday = item.tour_date === todayStr;
    const isStarted = item.status === 'IN_PROGRESS';
    
    // On autorise le clic SI : C'est aujourd'hui OU c'est déjà commencé (même si date passée)
    const canStart = isToday || isStarted;

    return (
      <Card style={[styles.card, !canStart && { opacity: 0.7 }]} mode="elevated">
        <Card.Title 
          title={item.name} 
          subtitle={isToday ? "Aujourd'hui" : `Prévu le : ${item.tour_date}`}
          subtitleStyle={{ color: isToday ? 'green' : 'gray', fontWeight: 'bold' }}
          left={(props) => <Badge size={24} style={{backgroundColor: item.status === 'IN_PROGRESS' ? 'orange' : isToday ? '#2196F3' : 'gray'}}>{item.status === 'IN_PROGRESS' ? 'GO' : isToday ? 'J' : '📅'}</Badge>}
        />
        <Card.Content>
          <Text variant="bodyMedium">Véhicule : {item.vehicle?.name || 'Non assigné'}</Text>
        </Card.Content>
        <Card.Actions>
          <Button 
            mode={canStart ? "contained" : "outlined"} 
            onPress={() => {
                if (canStart) {
                    onSelectTour(item);
                } else {
                    Alert.alert("Pas encore !", "Cette tournée est prévue pour une date ultérieure. Vous ne pouvez pas la démarrer maintenant.");
                }
            }}
            disabled={!canStart} 
            style={{ borderColor: canStart ? undefined : 'gray' }}
            textColor={canStart ? undefined : 'gray'}
          >
            {item.status === 'IN_PROGRESS' ? 'CONTINUER' : canStart ? 'DÉMARRER' : 'À VENIR'}
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.Content title="Mes Tournées" subtitle={`Équipe : ${teamName}`} />
        <Appbar.Action icon="history" onPress={onShowHistory} />
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
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