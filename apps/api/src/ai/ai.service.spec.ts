import { Test, TestingModule } from '@nestjs/testing';
import { AIService, chatFailureMessage } from './ai.service';
import { AiClientService } from './ai-client.service';

describe('AIService', () => {
  let service: AIService;
  let aiClient: any;

  beforeEach(async () => {
    aiClient = {
      summarize: jest.fn(),
      embeddings: jest.fn(),
      extractTask: jest.fn(),
      categorize: jest.fn(),
      extractEntities: jest.fn(),
      transcribe: jest.fn(),
      sentiment: jest.fn(),
      suggestTags: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIService, { provide: AiClientService, useValue: aiClient }],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSummary', () => {
    it('should generate summary', async () => {
      const content = 'This is a long content that needs to be summarized';
      aiClient.summarize.mockResolvedValue({ summary: 'Summary of the content', key_points: [] });

      const result = await service.generateSummary(content);

      expect(result).toBe('Summary of the content');
      expect(aiClient.summarize).toHaveBeenCalledWith(content);
    });

    it('should fall back to a truncated excerpt on error', async () => {
      const content = 'Test content';
      aiClient.summarize.mockRejectedValue(new Error('API error'));

      const result = await service.generateSummary(content);

      expect(result).toBe(content.substring(0, 200));
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding', async () => {
      const content = 'Test content';
      const expectedEmbedding = new Array(1536).fill(0.1);
      aiClient.embeddings.mockResolvedValue({
        embedding: expectedEmbedding,
        model: 'x',
        usage: {},
      });

      const result = await service.generateEmbedding(content);

      expect(result).toEqual(expectedEmbedding);
      expect(aiClient.embeddings).toHaveBeenCalledWith(content);
    });

    it('should return zero vector on error', async () => {
      aiClient.embeddings.mockRejectedValue(new Error('API error'));

      const result = await service.generateEmbedding('Test content');

      expect(result).toEqual(new Array(1536).fill(0));
    });
  });

  describe('extractTask', () => {
    it('should extract task from content and map field names', async () => {
      aiClient.extractTask.mockResolvedValue({
        title: 'Buy groceries',
        description: null,
        due_date: '2024-01-02',
        priority: 'MEDIUM',
      });

      const result = await service.extractTask('I need to buy groceries tomorrow');

      expect(result).toEqual({
        title: 'Buy groceries',
        description: null,
        dueDate: '2024-01-02',
        priority: 'MEDIUM',
      });
    });

    it('should return null on error', async () => {
      aiClient.extractTask.mockRejectedValue(new Error('API error'));

      const result = await service.extractTask('Test content');

      expect(result).toBeNull();
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio', async () => {
      const audioBuffer = Buffer.from('audio data');
      aiClient.transcribe.mockResolvedValue({
        text: 'Transcribed text',
        language: 'en',
        confidence: 1,
        segments: [],
      });

      const result = await service.transcribeAudio(audioBuffer);

      expect(result).toBe('Transcribed text');
      expect(aiClient.transcribe).toHaveBeenCalledWith(
        audioBuffer.toString('base64'),
        'audio.ogg',
        'en',
      );
    });

    it('should handle errors gracefully', async () => {
      aiClient.transcribe.mockRejectedValue(new Error('Transcription error'));

      const result = await service.transcribeAudio(Buffer.from('audio data'));

      expect(result).toBe('[Transcription failed]');
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment', async () => {
      const expectedSentiment = { sentiment: 'positive', confidence: 0.9, emotions: ['joy'] };
      aiClient.sentiment.mockResolvedValue(expectedSentiment);

      const result = await service.analyzeSentiment('I love this product!');

      expect(result).toEqual(expectedSentiment);
    });
  });

  describe('suggestTags', () => {
    it('should suggest tags', async () => {
      aiClient.suggestTags.mockResolvedValue({ tags: ['meeting', 'project', 'work'] });

      const result = await service.suggestTags('Meeting with John about the project');

      expect(result).toEqual(['meeting', 'project', 'work']);
    });
  });
});

describe('chatFailureMessage', () => {
  const axiosError = (status: number, detail: string) => ({ response: { status, data: { detail } } });

  it('explains a provider rate limit instead of saying "try again in a moment"', () => {
    const msg = chatFailureMessage(
      axiosError(
        502,
        "AI provider error: Error code: 429 - {'error': {'message': 'Rate limit reached for model " +
          "on tokens per day (TPD): Limit 200000, Used 197884, Requested 4568. Please try again in 17m39.26s.'}}",
      ),
    );
    expect(msg).toMatch(/usage limit/);
    expect(msg).toMatch(/about 18 minutes/);
    expect(msg).not.toMatch(/in a moment/);
  });

  it('handles a wait given in hours and minutes', () => {
    const msg = chatFailureMessage(axiosError(502, 'tokens per day ... Please try again in 1h5m'));
    expect(msg).toMatch(/about 65 minutes/);
  });

  it('still reports a rate limit when no wait time is given', () => {
    const msg = chatFailureMessage(axiosError(429, 'Rate limit reached'));
    expect(msg).toMatch(/usage limit/);
    expect(msg).not.toMatch(/back in about/);
  });

  it('keeps the generic message for other failures', () => {
    expect(chatFailureMessage(new Error('socket hang up'))).toMatch(/try again in a moment/);
  });
});

