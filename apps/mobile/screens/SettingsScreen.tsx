import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/ApiService';

export default function SettingsScreen({ navigation }: any) {
  const { signOut } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [profile, setProfile] = useState<{ name?: string; email: string } | null>(null);

  useEffect(() => {
    ApiService.getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteAccount();
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ],
    );
  };

  const settingSections = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          label: 'Profile',
          onPress: () => navigation.navigate('Profile'),
        },
        {
          icon: 'key-outline',
          label: 'Security',
          onPress: () => navigation.navigate('Security'),
        },
        {
          icon: 'card-outline',
          label: 'Subscription',
          onPress: () => navigation.navigate('Subscription'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          value: notifications,
          onValueChange: setNotifications,
        },
        {
          icon: 'moon-outline',
          label: 'Dark Mode',
          value: darkMode,
          onValueChange: setDarkMode,
        },
        {
          icon: 'finger-print-outline',
          label: 'Biometric Login',
          value: biometrics,
          onValueChange: setBiometrics,
        },
        {
          icon: 'sync-outline',
          label: 'Auto Sync',
          value: autoSync,
          onValueChange: setAutoSync,
        },
      ],
    },
    {
      title: 'Integrations',
      items: [
        {
          icon: 'logo-whatsapp',
          label: 'WhatsApp',
          onPress: () => navigation.navigate('WhatsAppIntegration'),
          color: '#25D366',
        },
        {
          icon: 'paper-plane-outline',
          label: 'Telegram',
          onPress: () => navigation.navigate('TelegramIntegration'),
          color: '#0088cc',
        },
        {
          icon: 'mail-outline',
          label: 'Email',
          onPress: () => navigation.navigate('EmailIntegration'),
          color: '#EA4335',
        },
        {
          icon: 'logo-google',
          label: 'Google Calendar',
          onPress: () => navigation.navigate('GoogleCalendarIntegration'),
          color: '#4285f4',
        },
        {
          icon: 'mail-open-outline',
          label: 'Outlook Calendar',
          onPress: () => navigation.navigate('OutlookCalendarIntegration'),
          color: '#0078d4',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help Center',
          onPress: () => Linking.openURL('https://zoorzio.app/help'),
        },
        {
          icon: 'document-text-outline',
          label: 'Terms of Service',
          onPress: () => Linking.openURL('https://zoorzio.app/terms'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Privacy Policy',
          onPress: () => Linking.openURL('https://zoorzio.app/privacy'),
        },
        {
          icon: 'chatbubble-outline',
          label: 'Contact Support',
          onPress: () => Linking.openURL('mailto:support@zoorzio.app'),
        },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <View style={styles.userSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color="#6366f1" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{profile?.name || 'Zoorzio User'}</Text>
          <Text style={styles.userEmail}>{profile?.email || ''}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Settings Sections */}
      {settingSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item: any, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={styles.settingItem}
                onPress={item.onPress}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={item.color || '#9ca3af'}
                  />
                  <Text style={styles.settingLabel}>{item.label}</Text>
                </View>
                {item.value !== undefined ? (
                  <Switch
                    value={item.value}
                    onValueChange={item.onValueChange}
                    trackColor={{ false: '#374151', true: '#6366f1' }}
                    thumbColor={item.value ? '#fff' : '#9ca3af'}
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#6b7280" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>
          Danger Zone
        </Text>
        <View style={styles.sectionContent}>
          <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={22} color="#f97316" />
              <Text style={[styles.settingLabel, { color: '#f97316' }]}>
                Logout
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleDeleteAccount}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
              <Text style={[styles.settingLabel, { color: '#ef4444' }]}>
                Delete Account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>Zoorzio v1.0.0</Text>
        <Text style={styles.appCopyright}>© 2026 Zoorzio. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#9ca3af',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  appVersion: {
    fontSize: 14,
    color: '#6b7280',
  },
  appCopyright: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
  },
});
