import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Button, ActivityIndicator, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function TeamSelectionScreen({ onTeamSelected, onLogout }: any) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayTeams();
  }, []);

  const loadTodayTeams = async () => {
    setLoading(true);
    try {
      // 1. Récupérer toutes les tournées
      const response = await api.get('/tours');
      
      // 2. Filtrer pour la date d'aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      
      // On cherche les tournées d'aujourd'hui qui sont PLANIFIÉES ou EN COURS
      const todaysTours = response.data.filter((t: any) => 
        t.tour_date === today && 
        ['PLANNED', 'IN_PROGRESS'].includes(t.status)
      );

      // 3. Extraire les équipes uniques de ces tournées
      const uniqueTeamsMap = new Map();
      todaysTours.forEach((tour: any) => {
        if (tour.team) {
            uniqueTeamsMap.set(tour.team.id, tour.team);
        }
      });

      setTeams(Array.from(uniqueTeamsMap.values()));

    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de charger les équipes du jour.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = async (team: any) => {
    // On enregistre l'identité de l'équipe choisie dans le téléphone
    await AsyncStorage.setItem('team_id', team.id);
    await AsyncStorage.setItem('team_name', team.name);
    
    // On prévient l'App qu'on a choisi
    onTeamSelected();
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.Content title="Qui êtes-vous ?" subtitle="Sélectionnez votre équipe" />
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      <View style={styles.content}>
        <Text variant="titleMedium" style={{marginBottom: 20, textAlign: 'center'}}>
            Équipes ayant une tournée aujourd'hui :
        </Text>

        {loading ? (
            <ActivityIndicator size="large" />
        ) : teams.length === 0 ? (
            <View style={styles.center}>
                <Text>Aucune tournée planifiée pour aujourd'hui.</Text>
                <Button onPress={loadTodayTeams} style={{marginTop: 20}}>Actualiser</Button>
            </View>
        ) : (
            <FlatList
                data={teams}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Card style={styles.card} onPress={() => handleSelectTeam(item)}>
                        <Card.Title 
                            title={item.name} 
                            subtitle={item.members_info}
                            left={(props) => <Avatar.Icon {...props} icon="account-group" />}
                            right={(props) => <IconButton {...props} icon="chevron-right" />}
                        />
                    </Card>
                )}
            />
        )}
      </View>
    </View>
  );
}

// Petit hack pour l'icône IconButton qui n'est pas importée
import { IconButton } from 'react-native-paper';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, padding: 20 },
  card: { marginBottom: 15, backgroundColor: 'white' },
  center: { alignItems: 'center', marginTop: 50 },
});