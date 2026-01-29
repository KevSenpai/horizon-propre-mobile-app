import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Card, Text, Avatar, ActivityIndicator, Chip } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../config/api';

export default function HistoryScreen({ onBack }: any) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const teamId = await AsyncStorage.getItem('team_id');
      if (!teamId) return;

      // Appel avec le filtre teamId
      const response = await api.get(`/collections?teamId=${teamId}`);
      setCollections(response.data);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSuccess = item.status === 'COMPLETED';
    // Formatage basique de la date
    const date = new Date(item.collected_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return (
      <Card style={styles.card} mode="elevated">
        <Card.Title
          title={item.client?.name || "Client inconnu"}
          subtitle={`${date} • ${item.tour?.name || 'Tournée'}`}
          left={(props) => (
            <Avatar.Icon 
                {...props} 
                icon={isSuccess ? "check" : "alert-circle"} 
                style={{ backgroundColor: isSuccess ? '#4caf50' : '#f44336' }} 
            />
          )}
          right={(props) => (
             <Chip 
                icon={isSuccess ? "check" : "close"} 
                style={{marginRight: 10, backgroundColor: 'transparent'}}
                textStyle={{color: isSuccess ? 'green' : 'red'}}
             >
                 {isSuccess ? "Fait" : "Raté"}
             </Chip>
          )}
        />
        {!isSuccess && item.reason_if_failed && (
            <Card.Content>
                <Text style={{color: 'red'}}>Motif : {item.reason_if_failed}</Text>
            </Card.Content>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title="Mon Historique" />
        <Appbar.Action icon="refresh" onPress={() => { setLoading(true); loadHistory(); }} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={collections}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
             <Text style={{textAlign: 'center', marginTop: 50, color: 'gray'}}>Aucune collecte enregistrée.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginBottom: 12, backgroundColor: 'white' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});