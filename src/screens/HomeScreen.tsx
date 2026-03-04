import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Appbar, Text, Badge, Button, ActivityIndicator, Surface, Avatar, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function HomeScreen({ onLogout, onSelectTour, onShowHistory }: any) {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Date d'aujourd'hui au format YYYY-MM-DD pour la comparaison
  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      const name = await AsyncStorage.getItem('team_name');
      const teamId = await AsyncStorage.getItem('team_id');
      setTeamName(name || 'Équipe');

      try {
        // 1. Tentative de récupération via l'API
        const response = await api.get('/tours');
        
        // Filtrage des missions : uniquement celles de l'équipe et valides
        const myTours = response.data.filter((t: any) => 
          (t.team?.id === teamId || t.team_id === teamId) && 
          ['PLANNED', 'IN_PROGRESS'].includes(t.status)
        );
        
        // Tri intelligent : En cours d'abord, puis par date
        myTours.sort((a: any, b: any) => {
          if (a.status === 'IN_PROGRESS') return -1;
          if (b.status === 'IN_PROGRESS') return 1;
          return a.tour_date.localeCompare(b.tour_date);
        });
        
        setTours(myTours);
        setIsOffline(false);
        // Sauvegarde en cache pour le prochain usage hors-ligne
        await AsyncStorage.setItem('cached_tours', JSON.stringify(myTours));

      } catch (networkError: any) {
        console.log("Erreur réseau ou API, chargement du cache...");
        setIsOffline(true);

        // Gestion session expirée
        if (networkError.response && networkError.response.status === 401) {
          Alert.alert("Session expirée", "Veuillez vous reconnecter.");
          onLogout();
          return;
        }

        // 2. Récupération des données sauvegardées (Mode Hors-ligne)
        const cached = await AsyncStorage.getItem('cached_tours');
        if (cached) {
          setTours(JSON.parse(cached));
        }
      }
    } catch (error) {
      console.error("Erreur générale loadData:", error);
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

  // --- RENDU : Carte d'une Tournée ---
  const renderTour = ({ item }: { item: any }) => {
    const isToday = item.tour_date === todayStr;
    const isStarted = item.status === 'IN_PROGRESS';
    const canStart = isToday || isStarted;

    // Design dynamique selon le statut
    const statusColor = isStarted ? '#F59E0B' : (isToday ? '#2196F3' : '#868E96');
    const statusBg = isStarted ? '#FEF3C7' : (isToday ? '#E0F2FE' : '#F1F3F5');
    const statusLabel = isStarted ? 'EN COURS' : (isToday ? "AUJOURD'HUI" : 'À VENIR');

    return (
      <Surface style={[styles.tourCard, !canStart && { opacity: 0.7 }]} elevation={2}>
        <View style={styles.cardHeader}>
          <Badge 
            size={26} 
            style={{ 
              backgroundColor: statusBg, 
              color: statusColor, 
              fontWeight: 'bold', 
              paddingHorizontal: 10 
            }}
          >
            {statusLabel}
          </Badge>
          <Text style={styles.dateText}>{item.tour_date}</Text>
        </View>

        <Divider style={{ backgroundColor: '#f0f0f0' }} />

        <View style={styles.cardBody}>
          <Text variant="titleLarge" style={styles.tourTitle}>{item.name}</Text>
          <View style={styles.infoRow}>
            <Avatar.Icon size={32} icon="truck" style={{backgroundColor: '#f4f6f8'}} color="#666" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Véhicule assigné</Text>
              <Text style={styles.infoValue}>{item.vehicle?.name || 'Non spécifié'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Button 
            mode={canStart ? "contained" : "elevated"} 
            icon={isStarted ? "play-circle" : (canStart ? "play" : "calendar-clock")}
            buttonColor={isStarted ? '#F59E0B' : (canStart ? '#40C057' : '#e9ecef')}
            textColor={canStart ? 'white' : '#888'}
            style={styles.actionButton}
            contentStyle={{ height: 50 }}
            labelStyle={{ fontSize: 15, fontWeight: 'bold' }}
            disabled={!canStart}
            onPress={() => {
              if (canStart) onSelectTour(item);
              else Alert.alert("Indisponible", "Cette tournée est prévue pour une date ultérieure.");
            }}
          >
            {isStarted ? 'CONTINUER LA MISSION' : (canStart ? 'DÉMARRER LA MISSION' : 'FEUILLE DE ROUTE BLOQUÉE')}
          </Button>
        </View>
      </Surface>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Mes Missions" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="history" onPress={onShowHistory} color="#333" />
        {/* CORRECTION : Suppression de tooltip (incompatible mobile) */}
        <Appbar.Action 
          icon="swap-horizontal" 
          onPress={onLogout} 
          color="#333" 
          accessibilityLabel="Changer d'équipe" 
        />
      </Appbar.Header>

      {/* --- Section Hero --- */}
      <View style={styles.heroSection}>
        <Text variant="headlineSmall" style={styles.heroTitle}>{teamName}</Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>
          {isOffline ? "⚠️ Mode hors-ligne : données du dernier chargement." : "Voici vos missions pour aujourd'hui."}
        </Text>
      </View>

      {/* --- Liste --- */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : (
          <FlatList
            data={tours}
            renderItem={renderTour}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Avatar.Icon size={80} icon="check-all" style={{backgroundColor: '#E8F5E9'}} color="#40C057" />
                <Text variant="titleLarge" style={styles.emptyTitle}>Rien à signaler</Text>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Aucune tournée n'est planifiée pour votre équipe actuellement.
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F4F6F8' },
  header: { backgroundColor: '#ffffff', elevation: 0 },
  headerTitle: { fontWeight: 'bold', color: '#333' },
  heroSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 3,
    zIndex: 10,
  },
  heroTitle: { fontWeight: '900', color: '#2196F3', marginBottom: 5 },
  heroSubtitle: { color: '#666' },
  content: { flex: 1, padding: 16 },
  tourCard: { marginBottom: 20, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fafafa' },
  dateText: { color: '#888', fontWeight: '600', fontSize: 14 },
  cardBody: { padding: 16 },
  tourTitle: { fontWeight: 'bold', color: '#1a1a1a', marginBottom: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoTextContainer: { marginLeft: 12 },
  infoLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 'bold' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '600', marginTop: 2 },
  cardFooter: { padding: 16, paddingTop: 0 },
  actionButton: { borderRadius: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 20 },
  emptyText: { textAlign: 'center', color: '#666' },
});