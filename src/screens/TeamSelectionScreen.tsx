import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Button, ActivityIndicator, Avatar, Surface } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function TeamSelectionScreen({ onTeamSelected, onLogout }: any) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayTeams();
  },[]);

  const loadTodayTeams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tours');
      const today = new Date().toISOString().split('T')[0];
      
      const todaysTours = response.data.filter((t: any) => 
        t.tour_date === today && 
        ['PLANNED', 'IN_PROGRESS'].includes(t.status)
      );

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
    await AsyncStorage.setItem('team_id', team.id);
    await AsyncStorage.setItem('team_name', team.name);
    onTeamSelected();
  };

  // --- COMPOSANT : État Vide (S'il n'y a pas de tournée) ---
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Avatar.Icon size={80} icon="calendar-check" style={styles.emptyIcon} color="#2196F3" />
      <Text variant="titleLarge" style={styles.emptyTitle}>Journée calme !</Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Aucune tournée n'est planifiée pour aujourd'hui. Profitez de ce temps pour l'entretien des véhicules ou contactez le bureau.
      </Text>
      <Button mode="contained" icon="refresh" onPress={loadTodayTeams} style={styles.refreshButton}>
        Rafraîchir
      </Button>
    </View>
  );

  // --- COMPOSANT : Carte d'une Équipe ---
  const renderTeamCard = ({ item }: { item: any }) => (
    <Surface style={styles.teamCard} elevation={2}>
      <View style={styles.cardInner}>
        {/* Avatar à gauche */}
        <Avatar.Icon size={54} icon="account-group" style={styles.avatar} color="#fff" />
        
        {/* Infos au centre */}
        <View style={styles.cardInfo}>
            <Text variant="titleMedium" style={styles.cardTitle}>{item.name}</Text>
            <Text variant="bodySmall" style={styles.cardSubtitle} numberOfLines={1}>
              {item.members_info ? `Membres : ${item.members_info}` : 'Équipe de collecte'}
            </Text>
        </View>

        {/* Bouton d'action à droite */}
        <Button 
            mode="contained" 
            onPress={() => handleSelectTeam(item)} 
            style={styles.selectButton}
            contentStyle={{ paddingHorizontal: 10 }}
            compact
        >
            C'EST NOUS
        </Button>
      </View>
    </Surface>
  );

  return (
    <View style={styles.mainContainer}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Horizon Propre 🌍" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="logout" onPress={onLogout} color="#d32f2f" />
      </Appbar.Header>

      {/* --- Section "Hero" Accueil --- */}
      <View style={styles.heroSection}>
         <Text variant="headlineMedium" style={styles.heroTitle}>Bonjour l'équipe ! 👋</Text>
         <Text variant="bodyLarge" style={styles.heroSubtitle}>Sélectionnez votre groupe pour récupérer votre itinéraire du jour.</Text>
      </View>

      {/* --- Liste des équipes --- */}
      <View style={styles.content}>
        {loading ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Recherche des tournées...</Text>
            </View>
        ) : (
            <FlatList
                data={teams}
                keyExtractor={(item) => item.id}
                renderItem={renderTeamCard}
                contentContainerStyle={teams.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
                ListEmptyComponent={renderEmptyState}
                showsVerticalScrollIndicator={false}
            />
        )}
      </View>
    </View>
  );
}

// --- STYLES MODERNES ---
const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
    backgroundColor: '#F4F6F8' // Fond légèrement gris pour faire ressortir les cartes blanches
  },
  header: {
    backgroundColor: '#ffffff',
    elevation: 0, // Enlever l'ombre pour la fusionner avec le hero
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  heroSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 10,
  },
  heroTitle: {
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  heroSubtitle: {
    color: '#666',
    lineHeight: 22,
  },
  content: { 
    flex: 1, 
    padding: 20,
    paddingTop: 30,
  },
  teamCard: { 
    marginBottom: 15, 
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    backgroundColor: '#2196F3', // Bleu Horizon
    marginRight: 15,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  cardSubtitle: {
    color: '#888',
    marginTop: 2,
  },
  selectButton: {
    borderRadius: 8,
    backgroundColor: '#40C057', // Vert d'action
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15, 
    color: '#666',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyIcon: {
    backgroundColor: '#E3F2FD', // Fond bleu très clair
    marginBottom: 20,
  },
  emptyTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  refreshButton: {
    paddingHorizontal: 20,
    borderRadius: 8,
  }
});