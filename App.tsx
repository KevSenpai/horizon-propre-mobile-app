import React, { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Provider as PaperProvider, TextInput, Button, Text, ActivityIndicator } from 'react-native-paper';
import { api } from './src/config/api';
import HomeScreen from './src/screens/HomeScreen';
import TourExecutionScreen from './src/screens/TourExecutionScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedTour, setSelectedTour] = useState<any>(null)
  const handleLogin = async () => {
    if (!teamName) {
      Alert.alert("Erreur", "Veuillez entrer le nom de l'équipe");
      return;
    }

    setLoading(true);
    try {
      // 1. On récupère la liste des équipes (MVP : on filtre côté client)
      const response = await api.get('/teams');
      const teams = response.data;

      // 2. On cherche l'équipe
      const team = teams.find((t: any) => t.name === teamName && t.status === 'ACTIVE');

      if (team) {
        // Succès !
        await AsyncStorage.setItem('team_id', team.id);
        await AsyncStorage.setItem('team_name', team.name);
        setIsLoggedIn(true);
        Alert.alert("Succès", `Bienvenue ${team.name} ! 🚛`);
      } else {
        Alert.alert("Erreur", "Équipe introuvable ou inactive.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur Réseau", "Impossible de contacter le serveur. Vérifiez l'IP.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setIsLoggedIn(false);
    setTeamName('');
  };

  // --- ÉCRAN D'ACCUEIL (Après Login) ---
  // --- ÉCRAN D'ACCUEIL ---
  if (isLoggedIn) {
      // Cas 1 : Une tournée est sélectionnée -> On affiche l'écran d'exécution
      if (selectedTour) {
        return (
          <PaperProvider>
            <TourExecutionScreen 
              tour={selectedTour} 
              onBack={() => setSelectedTour(null)} // Retour à la liste
            />
          </PaperProvider>
        );
      }

      // Cas 2 : Pas de tournée -> On affiche la liste (HomeScreen)
      return (
        <PaperProvider>
          <HomeScreen 
            onLogout={handleLogout} 
            onSelectTour={(tour: any) => setSelectedTour(tour)} // On sélectionne la tournée
          />
        </PaperProvider>
      );
    }

  // --- ÉCRAN DE LOGIN ---
  return (
    <PaperProvider>
      <View style={styles.container}>
        <Text variant="headlineLarge" style={styles.title}>Horizon Mobile 🌍</Text>
        
        <TextInput
          label="Nom de l'équipe"
          value={teamName}
          onChangeText={setTeamName}
          mode="outlined"
          style={styles.input}
          placeholder="Ex: Equipe Alpha"
        />
        
        <TextInput
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />

        <Button 
          mode="contained" 
          onPress={handleLogin} 
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          SE CONNECTER
        </Button>
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 40,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  input: {
    width: '100%',
    marginBottom: 15,
  },
  button: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 5,
  },
});