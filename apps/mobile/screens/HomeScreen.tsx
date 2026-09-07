import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../services/ApiService';

interface Memory {
  id: string;
  content: string;
  summary: string;
  type: string;
  source: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

export default function HomeScreen({ navigation }: any) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [recentMemories, pendingTasks] = await Promise.all([
        ApiService.getMemories({ limit: 5 }),
        ApiService.getTasks({ status: 'PENDING', limit: 5 }),
      ]);
      setMemories(recentMemories);
      setTasks(pendingTasks);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const quickActions = [
    {
      id: 'capture',
      icon: 'camera' as const,
      title: 'Capture',
      subtitle: 'Add a memory',
      color: '#4CAF50',
      onPress: () => navigation.navigate('Capture'),
    },
    {
      id: 'voice',
      icon: 'mic' as const,
      title: 'Voice Note',
      subtitle: 'Record audio',
      color: '#2196F3',
      onPress: () => navigation.navigate('Capture', { mode: 'voice' }),
    },
    {
      id: 'tasks',
      icon: 'checkmark-circle' as const,
      title: 'Tasks',
      subtitle: `${tasks.filter(t => t.status === 'PENDING').length} pending`,
      color: '#FF9800',
      onPress: () => navigation.navigate('Tasks'),
    },
    {
      id: 'calendar',
      icon: 'calendar' as const,
      title: 'Calendar',
      subtitle: 'View events',
      color: '#9C27B0',
      onPress: () => navigation.navigate('Calendar'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.header}
      >
        <Text style={styles.greeting}>Welcome to Zoorzio</Text>
        <Text style={styles.subtitle}>The memory layer that actually remembers</Text>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.quickAction, { borderLeftColor: action.color }]}
              onPress={action.onPress}
            >
              <Ionicons name={action.icon} size={24} color={action.color} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Memories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Memories</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Memory')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {memories.length > 0 ? (
          memories.slice(0, 3).map((memory) => (
            <TouchableOpacity
              key={memory.id}
              style={styles.memoryCard}
              onPress={() => navigation.navigate('Memory', { id: memory.id })}
            >
              <View style={styles.memoryHeader}>
                <Ionicons
                  name={getSourceIcon(memory.source)}
                  size={16}
                  color="#6366f1"
                />
                <Text style={styles.memorySource}>{memory.source}</Text>
                <Text style={styles.memoryTime}>
                  {formatTime(memory.createdAt)}
                </Text>
              </View>
              <Text style={styles.memoryContent} numberOfLines={2}>
                {memory.content}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No memories yet. Start capturing!</Text>
        )}
      </View>

      {/* Upcoming Tasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {tasks.filter(t => t.status === 'PENDING').length > 0 ? (
          tasks
            .filter(t => t.status === 'PENDING')
            .slice(0, 3)
            .map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Ionicons
                    name="ellipse-outline"
                    size={16}
                    color={getPriorityColor(task.priority)}
                  />
                  <Text style={styles.taskTitle}>{task.title}</Text>
                </View>
                {task.dueDate && (
                  <Text style={styles.taskDue}>
                    Due: {formatDate(task.dueDate)}
                  </Text>
                )}
              </View>
            ))
        ) : (
          <Text style={styles.emptyText}>No pending tasks. Great job!</Text>
        )}
      </View>
    </ScrollView>
  );
}

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'WHATSAPP':
      return 'logo-whatsapp';
    case 'TELEGRAM':
      return 'paper-plane';
    case 'EMAIL':
      return 'mail';
    case 'VOICE':
      return 'mic';
    default:
      return 'document-text';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return '#ef4444';
    case 'HIGH':
      return '#f97316';
    case 'MEDIUM':
      return '#eab308';
    case 'LOW':
      return '#22c55e';
    default:
      return '#6b7280';
  }
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a5b4fc',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  seeAll: {
    fontSize: 14,
    color: '#6366f1',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  quickActionText: {
    marginLeft: 12,
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#a5b4fc',
    marginTop: 2,
  },
  memoryCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memorySource: {
    fontSize: 12,
    color: '#6366f1',
    marginLeft: 6,
    fontWeight: '500',
  },
  memoryTime: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 'auto',
  },
  memoryContent: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
  },
  taskCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
  },
  taskDue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginLeft: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    padding: 24,
  },
});
