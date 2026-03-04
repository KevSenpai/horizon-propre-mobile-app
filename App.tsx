import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { Provider as PaperProvider, TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { api } from './src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Écrans
import HomeScreen from './src/screens/HomeScreen';
import TeamSelectionScreen from './src/screens/TeamSelectionScreen';
import TourExecutionScreen from './src/screens/TourExecutionScreen';
import HistoryScreen from './src/screens/HistoryScreen';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasTeamSelected, setHasTeamSelected] = useState(false);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    const token = await AsyncStorage.getItem('access_token');
    const teamId = await AsyncStorage.getItem('team_id');
    if (token) {
      setIsLoggedIn(true);
      if (teamId) setHasTeamSelected(true);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password: password.trim()
      });

      const { access_token } = response.data;
      await AsyncStorage.setItem('access_token', access_token);
      await AsyncStorage.removeItem('team_id');
      await AsyncStorage.removeItem('team_name');
      
      setIsLoggedIn(true);
      setHasTeamSelected(false);
    } catch (err: any) {
      setError("Identifiants incorrects ou serveur injoignable.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setIsLoggedIn(false);
    setHasTeamSelected(false);
    setSelectedTour(null);
    setShowHistory(false);
    setEmail('');
    setPassword('');
  };

  // --- RENDU CONDITIONNEL (NAVIGATION) ---
  
  if (isLoggedIn && hasTeamSelected && selectedTour) {
    return <PaperProvider><TourExecutionScreen tour={selectedTour} onBack={() => setSelectedTour(null)} /></PaperProvider>;
  }

  if (isLoggedIn && hasTeamSelected && showHistory) {
    return <PaperProvider><HistoryScreen onBack={() => setShowHistory(false)} /></PaperProvider>;
  }

  if (isLoggedIn && hasTeamSelected) {
    return (
      <PaperProvider>
        <HomeScreen 
          onLogout={() => { setHasTeamSelected(false); setSelectedTour(null); }} 
          onSelectTour={setSelectedTour}
          onShowHistory={() => setShowHistory(true)}
        />
      </PaperProvider>
    );
  }

  if (isLoggedIn && !hasTeamSelected) {
    return <PaperProvider><TeamSelectionScreen onTeamSelected={() => setHasTeamSelected(true)} onLogout={handleLogout}/></PaperProvider>;
  }

  // --- ÉCRAN DE CONNEXION AMÉLIORÉ ---
  return (
    <PaperProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerSection}>
            <Surface style={styles.logoCircle} elevation={4}>
              <Text style={{ fontSize: 50 }}>🌍</Text>
            </Surface>
            <Text variant="headlineMedium" style={styles.appTitle}>HORIZON PROPRE</Text>
            <Text variant="bodyMedium" style={styles.appSubtitle}>Gestion de collecte & d'assainissement</Text>
          </View>

          <Surface style={styles.loginCard} elevation={2}>
            <Text variant="titleLarge" style={styles.cardTitle}>Connexion Staff</Text>
            
            <View style={styles.inputGap}>
              <TextInput
                label="Email professionnel"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                left={ <TextInput.Icon icon="email" color={email ? "#2196F3" : "#999"} /> }
                error={!!error}
              />
            </View>

            <View style={styles.inputGap}>
              <TextInput
                label="Mot de passe"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                mode="outlined"
                secureTextEntry
                left={ <TextInput.Icon icon="lock" color={password ? "#2196F3" : "#999"} /> }
                error={!!error}
              />
              <HelperText type="error" visible={!!error} style={{ paddingLeft: 0 }}>
                {error}
              </HelperText>
            </View>

            <Button 
              mode="contained" 
              onPress={handleLogin} 
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              contentStyle={{ height: 50 }}
              labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
            >
              ACCÉDER AU TERRAIN
            </Button>
          </Surface>

          <Text style={styles.footerText}>By SEMITEJA Kev • Goma, RDC</Text>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 25,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontWeight: '900',
    color: '#1a1a1a',
    letterSpacing: 1,
  },
  appSubtitle: {
    color: '#666',
    marginTop: 5,
  },
  loginCard: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 20,
    width: '100%',
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#333',
    textAlign: 'center'
  },
  inputGap: {
    marginBottom: 10,
  },
  loginButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#2196F3',
  },
  footerText: {
    textAlign: 'center',
    color: '#adb5bd',
    marginTop: 40,
    fontSize: 12,
  }
});