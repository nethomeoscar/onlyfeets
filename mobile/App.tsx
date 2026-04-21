// ═══════════════════════════════════════════════════════════════
// OnlyFeets Mobile App - React Native + Expo
// ═══════════════════════════════════════════════════════════════

// package.json dependencies:
// expo, react-native, @react-navigation/native, @react-navigation/bottom-tabs,
// @react-navigation/stack, expo-camera, expo-image-picker, expo-video,
// @stripe/stripe-react-native, socket.io-client, zustand, @tanstack/react-query,
// react-native-fast-image, expo-notifications, expo-secure-store,
// expo-local-authentication (biometrics), react-native-reanimated,
// react-native-gesture-handler, expo-blur

// ─── App.tsx ─────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Screens
import FeedScreen from './screens/FeedScreen';
import ExploreScreen from './screens/ExploreScreen';
import MessagesScreen from './screens/MessagesScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import CreatorProfileScreen from './screens/CreatorProfileScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import NewPostScreen from './screens/NewPostScreen';
import CreatorDashboardScreen from './screens/CreatorDashboardScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const queryClient = new QueryClient();

// ─── Colors ──────────────────────────────────────────────────────────────────
export const COLORS = {
  background: '#0f1117',
  card: '#161b27',
  elevated: '#1d2335',
  border: '#232a3b',
  primary: '#ec4899',
  primaryDark: '#be185d',
  text: '#f0f0f8',
  muted: '#6b7280',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

// ─── Main Tab Navigator ───────────────────────────────────────────────────────

function TabIcon({ name, focused, badge }: { name: string; focused: boolean; badge?: number }) {
  const icons: Record<string, string> = {
    Feed: '🏠', Explore: '🔍', New: '➕', Messages: '💬',
    Notifications: '🔔', Profile: '👤', Dashboard: '📊',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>
      {badge != null && badge > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -8,
          backgroundColor: COLORS.primary, borderRadius: 8,
          minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, marginTop: 2 },
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="Feed" focused={focused} /> }} />
      <Tab.Screen name="Explore" component={ExploreScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="Explore" focused={focused} />, tabBarLabel: 'Explorar' }} />
      <Tab.Screen name="New" component={NewPostScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 24, lineHeight: 28 }}>+</Text>
            </View>
          ),
        }} />
      <Tab.Screen name="Messages" component={MessagesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="Messages" focused={focused} />, tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="Notifications" focused={focused} />, tabBarLabel: 'Notifs' }} />
    </Tab.Navigator>
  );
}

// ─── Root Stack ───────────────────────────────────────────────────────────────

function RootNavigator() {
  // In production: check auth state from zustand store
  const isAuthenticated = true; // useAuthStore(s => !!s.user)

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.background } }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          <Stack.Screen name="Dashboard" component={CreatorDashboardScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    // Configure push notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_KEY!}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}

// ─── FeedScreen.tsx ───────────────────────────────────────────────────────────

/*
import { FlatList, RefreshControl, View, Text, StyleSheet } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PostCard from '../components/PostCard';
import StoriesRow from '../components/StoriesRow';
import LoadingSpinner from '../components/LoadingSpinner';

export default function FeedScreen() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/posts/feed?page=${pageParam}`);
      return data;
    },
    getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const posts = data?.pages.flatMap(p => p.posts) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        ListHeaderComponent={<StoriesRow />}
        renderItem={({ item }) => <PostCard post={item} />}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />}
        ListFooterComponent={isFetchingNextPage ? <LoadingSpinner /> : null}
      />
    </View>
  );
}
*/

// ─── PostCard component (React Native) ───────────────────────────────────────

/*
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

export function PostCard({ post, navigation }) {
  return (
    <View style={styles.card}>
      // Header
      <TouchableOpacity style={styles.header} onPress={() => navigation.navigate('CreatorProfile', { username: post.creator.username })}>
        <FastImage source={{ uri: post.creator.avatarUrl }} style={styles.avatar} />
        <View>
          <Text style={styles.name}>{post.creator.displayName}</Text>
          <Text style={styles.username}>@{post.creator.username}</Text>
        </View>
      </TouchableOpacity>

      // Media
      {post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.isPPV && !post.isUnlocked ? (
            <TouchableOpacity style={styles.lockedOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.unlockText}>Desbloquear por ${post.ppvPrice}</Text>
            </TouchableOpacity>
          ) : (
            <FastImage source={{ uri: post.media[0].url }} style={styles.media} resizeMode="cover" />
          )}
        </View>
      )}

      // Actions
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => handleLike()}>
          <Text>{post.isLiked ? '❤️' : '🤍'} {post.likesCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text>💬 {post.commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowTip(true)}>
          <Text>🎁 Propina</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
*/

// ─── Login Screen ─────────────────────────────────────────────────────────────

/*
import { KeyboardAvoidingView, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setAuth } = useAuthStore();

  const handleBiometricLogin = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Accede con Face ID / Huella',
    });
    if (result.success) {
      // Use stored credentials
    }
  };

  const handleLogin = async () => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al iniciar sesión');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container}>
      <Text style={styles.logo}>🦶 OnlyFeets</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Contraseña" secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Iniciar sesión</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleBiometricLogin}>
        <Text>🔐 Face ID / Huella</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
*/

// ─── Push Notifications Setup ────────────────────────────────────────────────

/*
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return; // Simulator

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Send to backend
  await api.post('/notifications/device-token', {
    token,
    platform: Platform.OS,
  });
}
*/

// ─── Image/Video Upload (Mobile) ──────────────────────────────────────────────

/*
import * as ImagePicker from 'expo-image-picker';

export const pickAndUploadMedia = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsMultipleSelection: true,
    quality: 0.9,
  });

  if (result.canceled) return null;

  const formData = new FormData();
  result.assets.forEach((asset, i) => {
    formData.append('files', {
      uri: asset.uri,
      type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
      name: `file_${i}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
    } as any);
  });

  const { data } = await api.post('/upload/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.files;
};
*/
