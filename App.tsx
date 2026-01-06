import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Provider as PaperProvider, TextInput, Button, Text } from 'react-native-paper';
import { api } from './src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import TeamSelectionScreen from './src/screens/TeamSelectionScreen'; // <--- IMPORT
import TourExecutionScreen from './src/screens/TourExecutionScreen';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // États de navigation
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasTeamSelected, setHasTeamSelected] = useState(false);
  const [selectedTour, setSelectedTour] = useState<any>(null);

  // Vérifier l'état au lancement
  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    const token = await AsyncStorage.getItem('access_token');
    const teamId = await AsyncStorage.getItem('team_id');
    
    if (token) {
        setIsLoggedIn(true);
        if (teamId) {
            setHasTeamSelected(true);
        }
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password: password.trim()
      });

      const { access_token } = response.data;

      // On stocke le token générique
      await AsyncStorage.setItem('access_token', access_token);
      
      // On nettoie toute vieille sélection d'équipe
      await AsyncStorage.removeItem('team_id');
      await AsyncStorage.removeItem('team_name');
      
      setIsLoggedIn(true);
      setHasTeamSelected(false); // On force la sélection

    } catch (error: any) {
      console.error(error);
      Alert.alert("Erreur", "Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setIsLoggedIn(false);
    setHasTeamSelected(false);
    setSelectedTour(null);
    setEmail('');
    setPassword('');
  };

  const handleChangeTeam = async () => {
      // Permet de revenir à la sélection d'équipe sans se déconnecter totalement
      await AsyncStorage.removeItem('team_id');
      setHasTeamSelected(false);
      setSelectedTour(null);
  };

  // --- 1. ROUTAGE : ÉCRAN DE TRAVAIL (CARTE/LISTE) ---
  if (isLoggedIn && hasTeamSelected && selectedTour) {
      return (
        <PaperProvider>
            <TourExecutionScreen 
              tour={selectedTour} 
              onBack={() => setSelectedTour(null)} 
            />
        </PaperProvider>
      );
  }

  // --- 2. ROUTAGE : ACCUEIL (LISTE DES TOURNÉES DE L'ÉQUIPE) ---
  if (isLoggedIn && hasTeamSelected) {
    return (
      <PaperProvider>
        <HomeScreen 
          onLogout={handleChangeTeam} // Le bouton logout renvoie au choix d'équipe
          onSelectTour={setSelectedTour} 
        />
      </PaperProvider>
    );
  }

  // --- 3. ROUTAGE : SÉLECTION D'ÉQUIPE (NOUVEAU) ---
  if (isLoggedIn && !hasTeamSelected) {
      return (
          <PaperProvider>
              <TeamSelectionScreen 
                  onTeamSelected={() => setHasTeamSelected(true)}
                  onLogout={handleLogout}
              />
          </PaperProvider>
      );
  }

  // --- 4. ROUTAGE : LOGIN ---
  return (
    <PaperProvider>
      <View style={styles.container}>
        <Text variant="headlineLarge" style={styles.title}>Horizon Mobile 🚛</Text>
        <Text style={{marginBottom: 20, color: 'gray'}}>Accès Terrain</Text>
        
        <TextInput
          label="Email commun"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
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
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { marginBottom: 10, fontWeight: 'bold', color: '#2196F3' },
  input: { width: '100%', marginBottom: 15 },
  button: { width: '100%', marginTop: 10, paddingVertical: 5 },
});