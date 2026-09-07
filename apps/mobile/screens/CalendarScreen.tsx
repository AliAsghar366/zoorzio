import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/ApiService';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  calendar: {
    name: string;
    color: string;
    provider: string;
  };
}

export default function CalendarScreen({ navigation }: any) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchEvents();
  }, [selectedDate]);

  const fetchEvents = async () => {
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const data = await ApiService.getCalendarEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysInWeek = (date: Date) => {
    const days = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const renderEvent = ({ item }: { item: CalendarEvent }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => navigation.navigate('EventDetail', { id: item.id })}
    >
      <View style={[styles.eventIndicator, { backgroundColor: item.calendar.color }]} />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.eventDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.eventDetails}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.eventTime}>
            {formatTime(item.startTime)} - {formatTime(item.endTime)}
          </Text>
        </View>
        {item.location ? (
          <View style={styles.eventDetails}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            <Text style={styles.eventLocation} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.calendarBadge}>
        <Text style={[styles.calendarName, { color: item.calendar.color }]}>
          {item.calendar.name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const days = getDaysInWeek(selectedDate);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Week View */}
      <View style={styles.weekContainer}>
        {days.map((day, index) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const isSelected = day.toDateString() === selectedDate.toDateString();

          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayContainer, isSelected && styles.daySelected]}
              onPress={() => setSelectedDate(day)}
            >
              <Text
                style={[
                  styles.dayName,
                  isSelected && styles.dayNameSelected,
                ]}
              >
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  isToday && styles.dayNumberToday,
                  isSelected && styles.dayNumberSelected,
                ]}
              >
                {day.getDate()}
              </Text>
              {isToday && <View style={styles.todayIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events Header */}
      <View style={styles.eventsHeader}>
        <Text style={styles.eventsTitle}>{formatDate(selectedDate)}</Text>
        <Text style={styles.eventsCount}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Events List */}
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.eventsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>No events for this day</Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateEvent')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

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
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  dayContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 44,
  },
  daySelected: {
    backgroundColor: '#6366f1',
  },
  dayName: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dayNameSelected: {
    color: '#fff',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  dayNumberToday: {
    color: '#6366f1',
  },
  dayNumberSelected: {
    color: '#fff',
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6366f1',
    marginTop: 4,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  eventsCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventsList: {
    padding: 16,
    paddingTop: 0,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  eventIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  eventLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  calendarBadge: {
    justifyContent: 'center',
  },
  calendarName: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
