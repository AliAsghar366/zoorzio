import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import ApiService from '../services/ApiService';

export default function CaptureScreen({ navigation, route }: any) {
  const [content, setContent] = useState('');
  const [selectedType, setSelectedType] = useState('NOTE');
  const [selectedSource, setSelectedSource] = useState('NATIVE_APP');
  const [tags, setTags] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textInputRef = useRef<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const parseTags = () =>
    tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const memoryTypes = [
    { id: 'NOTE', label: 'Note', icon: 'document-text' as const, color: '#6366f1' },
    { id: 'TASK', label: 'Task', icon: 'checkmark-circle' as const, color: '#22c55e' },
    { id: 'REMINDER', label: 'Reminder', icon: 'alarm' as const, color: '#f59e0b' },
    { id: 'MESSAGE', label: 'Message', icon: 'chatbubble' as const, color: '#3b82f6' },
    { id: 'VOICE_NOTE', label: 'Voice', icon: 'mic' as const, color: '#ef4444' },
  ];

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    setIsSaving(true);

    try {
      await ApiService.createMemory({
        content: content.trim(),
        type: selectedType,
        source: selectedSource,
        tags: parseTags(),
      });

      Alert.alert('Success', 'Memory saved successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setContent('');
            setTags('');
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save memory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (!recording) return;

      try {
        setIsTranscribing(true);
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        const uri = recording.getURI();
        if (!uri) throw new Error('Recording produced no file');

        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const memory = await ApiService.createVoiceMemory(audioBase64, parseTags());
        setContent(memory.content);
        setSelectedType('VOICE_NOTE');
        Alert.alert('Voice note saved', 'Your recording was transcribed and saved as a memory.');
      } catch (error) {
        console.error('Voice capture failed:', error);
        Alert.alert('Error', 'Failed to transcribe and save the voice note.');
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Microphone permission is required');
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const handleImageCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      // Zoorzio doesn't yet have an image upload/storage endpoint (only
      // channel-sourced images from WhatsApp/Telegram get analyzed server
      // side), so we save a plain note referencing the capture rather than
      // silently pretending the image itself was processed.
      try {
        await ApiService.createMemory({
          content: content.trim() || 'Photo captured from the Zoorzio app',
          type: 'IMAGE',
          source: selectedSource,
          tags: parseTags(),
          metadata: { localUri: result.assets?.[0]?.uri },
        });
        Alert.alert('Saved', 'A memory was created for this photo.');
      } catch (error) {
        Alert.alert('Error', 'Failed to save the photo memory.');
      }
    }
  };

  const handleDocumentUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      const file = result.assets?.[0];
      try {
        await ApiService.createMemory({
          content: content.trim() || `Document captured: ${file?.name ?? 'unnamed file'}`,
          type: 'FILE',
          source: selectedSource,
          tags: parseTags(),
          metadata: { localUri: file?.uri, fileName: file?.name },
        });
        Alert.alert('Saved', 'A memory was created for this document.');
      } catch (error) {
        Alert.alert('Error', 'Failed to save the document memory.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
          <Text style={styles.headerTitle}>Capture Memory</Text>
          <Text style={styles.headerSubtitle}>
            Add anything you want to remember
          </Text>
        </LinearGradient>

        {/* Memory Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeScroll}
          >
            {memoryTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  selectedType === type.id && {
                    borderColor: type.color,
                    backgroundColor: `${type.color}20`,
                  },
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Ionicons
                  name={type.icon}
                  size={20}
                  color={selectedType === type.id ? type.color : '#6b7280'}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    selectedType === type.id && { color: type.color },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content</Text>
          <TextInput
            ref={textInputRef}
            style={styles.contentInput}
            placeholder="What do you want to remember?"
            placeholderTextColor="#6b7280"
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.actionButton, isRecording && styles.recordingButton]}
              onPress={handleVoiceRecord}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={24}
                  color={isRecording ? '#fff' : '#ef4444'}
                />
              )}
              <Text
                style={[
                  styles.actionLabel,
                  isRecording && { color: '#fff' },
                ]}
              >
                {isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Voice Note'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleImageCapture}
            >
              <Ionicons name="camera" size={24} color="#3b82f6" />
              <Text style={styles.actionLabel}>Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDocumentUpload}
            >
              <Ionicons name="document" size={24} color="#22c55e" />
              <Text style={styles.actionLabel}>Document</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tags Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add tags separated by commas"
            placeholderTextColor="#6b7280"
            value={tags}
            onChangeText={setTags}
          />
        </View>

        {/* Save Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Memory</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a5b4fc',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  typeScroll: {
    marginBottom: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  typeLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 8,
  },
  contentInput: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    width: '30%',
  },
  recordingButton: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  actionLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
