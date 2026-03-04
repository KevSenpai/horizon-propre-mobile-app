import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Appbar, Text, ActivityIndicator, Surface, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function HistoryScreen({ onBack }: any) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const teamId = await AsyncStorage.getItem('team_id');
      if (!teamId) return;

      const response = await api.get(`/collections?teamId=${teamId}`);
      setCollections(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  },[]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  // --- COMPOSANT : État Vide ---
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Avatar.Icon size={80} icon="history" style={styles.emptyIcon} color="#868E96" />
      <Text variant="titleLarge" style={styles.emptyTitle}>Aucun historique</Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Les collectes que vous validez apparaîtront ici.
      </Text>
    </View>
  );

  // --- COMPOSANT : Carte d'historique ---
  const renderItem = ({ item }: { item: any }) => {
    const isSuccess = item.status === 'COMPLETED';
    
    // Formatage propre de la date et l'heure
    const dateObj = new Date(item.collected_at);
    const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
      <Surface style={[styles.recordCard, isSuccess ? styles.cardSuccess : styles.cardFail]} elevation={1}>
        <View style={styles.cardInner}>
          
          {/* Icône de statut à gauche */}
          <Avatar.Icon 
            size={46} 
            icon={isSuccess ? "check-bold" : "close-thick"} 
            style={[styles.statusIcon, { backgroundColor: isSuccess ? '#D3F9D8' : '#FFE3E3' }]} 
            color={isSuccess ? '#2B8A3E' : '#C92A2A'} 
          />
          
          {/* Informations au centre */}
          <View style={styles.infoContainer}>
            <Text variant="titleMedium" style={styles.clientName}>
              {item.client?.name || "Client inconnu"}
            </Text>
            
            <View style={styles.metaRow}>
                <Text style={styles.metaText}>{dateStr} à {timeStr}</Text>
                <Text style={styles.metaDot}> • </Text>
                <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                  {item.tour?.name || 'Tournée'}
                </Text>
            </View>

            {/* Affichage du motif d'échec si applicable */}
            {!isSuccess && item.reason_if_failed && (
              <Text style={styles.reasonText}>Motif : {item.reason_if_failed}</Text>
            )}
          </View>
          
        </View>
      </Surface>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={onBack} color="#333" />
        <Appbar.Content title="" />
      </Appbar.Header>

      {/* --- Section "Hero" Historique --- */}
      <View style={styles.heroSection}>
         <Text variant="headlineSmall" style={styles.heroTitle}>Historique</Text>
         <Text variant="bodyMedium" style={styles.heroSubtitle}>
             Retrouvez les traces de vos dernières collectes et signalements sur le terrain.
         </Text>
      </View>

      {/* --- Liste de l'historique --- */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#2196F3" /></View>
        ) : (
          <FlatList
            data={collections}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={collections.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />}
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
    backgroundColor: '#F4F6F8' 
  },
  header: {
    backgroundColor: '#ffffff',
    elevation: 0, 
  },
  heroSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 25,
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
    color: '#333',
    marginBottom: 5,
  },
  heroSubtitle: {
    color: '#666',
  },
  content: { 
    flex: 1, 
    padding: 16,
  },
  recordCard: { 
    marginBottom: 12, 
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardSuccess: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#40C057',
  },
  cardFail: {
    backgroundColor: '#fff5f5', // Fond très légèrement rouge
    borderLeftWidth: 4,
    borderLeftColor: '#FA5252',
  },
  cardInner: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  clientName: {
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#868E96',
    fontSize: 13,
  },
  metaDot: {
    color: '#CED4DA',
    marginHorizontal: 4,
  },
  reasonText: {
    color: '#E03131',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
    backgroundColor: '#FFE3E3',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIcon: {
    backgroundColor: '#F1F3F5', 
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
    paddingHorizontal: 30,
  },
});