import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InteractiveEmbedType, Prisma } from '@prisma/client';

export type EmbedType =
  | 'poll'
  | 'qa'
  | 'form'
  | 'quiz'
  | 'reaction'
  | 'wordcloud';

const embedTypeToPrisma = (type: EmbedType): InteractiveEmbedType => {
  switch (type) {
    case 'poll':
      return InteractiveEmbedType.POLL;
    case 'qa':
      return InteractiveEmbedType.QA;
    case 'form':
      return InteractiveEmbedType.FORM;
    case 'quiz':
      return InteractiveEmbedType.QUIZ;
    case 'wordcloud':
      return InteractiveEmbedType.WORD_CLOUD;
    default:
      throw new BadRequestException(`Unsupported embed type: ${type}`);
  }
};

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  showResults: boolean;
  closedAt?: Date;
}

export interface QAQuestion {
  id: string;
  question: string;
  authorName?: string;
  authorId?: string;
  upvotes: number;
  answered: boolean;
  answer?: string;
  pinnned: boolean;
  createdAt: Date;
}

export interface QASession {
  id: string;
  title: string;
  questions: QAQuestion[];
  allowAnonymous: boolean;
  moderationEnabled: boolean;
  isOpen: boolean;
}

export interface FormField {
  id: string;
  type:
    | 'text'
    | 'email'
    | 'number'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'rating';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  submissions: number;
  isOpen: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  showCorrectAfterSubmit: boolean;
  timeLimit?: number;
}

export interface WordCloudConfig {
  id: string;
  prompt: string;
  words: Record<string, number>;
  maxResponses: number;
  isOpen: boolean;
}

export interface InteractiveEmbed {
  id: string;
  projectId: string;
  slideId: string;
  type: EmbedType;
  config: Poll | QASession | Form | Quiz | WordCloudConfig;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class InteractiveEmbedsService {
  private readonly logger = new Logger(InteractiveEmbedsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new poll
   */
  async createPoll(
    projectId: string,
    slideId: string,
    userId: string,
    data: {
      question: string;
      options: string[];
      allowMultiple?: boolean;
      showResults?: boolean;
    },
  ): Promise<InteractiveEmbed> {
    const poll: Poll = {
      id: this.generateId(),
      question: data.question,
      options: data.options.map((text, idx) => ({
        id: `opt_${idx}`,
        text,
        votes: 0,
      })),
      allowMultiple: data.allowMultiple ?? false,
      showResults: data.showResults ?? true,
    };

    return this.createEmbed(projectId, slideId, userId, 'poll', poll);
  }

  /**
   * Vote on a poll
   */
  async votePoll(
    embedId: string,
    optionIds: string[],
    voterId?: string,
  ): Promise<Poll> {
    const embed = await this.getEmbed(embedId);

    if (embed.type !== 'poll') {
      throw new BadRequestException('Not a poll embed');
    }

    const poll = embed.config as Poll;

    if (poll.closedAt) {
      throw new BadRequestException('Poll is closed');
    }

    if (!poll.allowMultiple && optionIds.length > 1) {
      throw new BadRequestException('Only one option allowed');
    }

    // Update vote counts
    poll.options = poll.options.map((opt) => ({
      ...opt,
      votes: optionIds.includes(opt.id) ? opt.votes + 1 : opt.votes,
    }));

    await this.updateEmbed(embedId, poll);

    // Track the vote
    await this.prisma.interactiveResponse.create({
      data: {
        embedId,
        responseType: 'poll_vote',
        data: { optionIds },
        responderId: voterId,
      },
    });

    return poll;
  }

  /**
   * Create Q&A session
   */
  async createQASession(
    projectId: string,
    slideId: string,
    userId: string,
    data: {
      title: string;
      allowAnonymous?: boolean;
      moderationEnabled?: boolean;
    },
  ): Promise<InteractiveEmbed> {
    const qa: QASession = {
      id: this.generateId(),
      title: data.title,
      questions: [],
      allowAnonymous: data.allowAnonymous ?? true,
      moderationEnabled: data.moderationEnabled ?? false,
      isOpen: true,
    };

    return this.createEmbed(projectId, slideId, userId, 'qa', qa);
  }

  /**
   * Submit a question to Q&A
   */
  async submitQuestion(
    embedId: string,
    question: string,
    authorName?: string,
    authorId?: string,
  ): Promise<QAQuestion> {
    const embed = await this.getEmbed(embedId);

    if (embed.type !== 'qa') {
      throw new BadRequestException('Not a Q&A embed');
    }

    const qa = embed.config as QASession;

    if (!qa.isOpen) {
      throw new BadRequestException('Q&A session is closed');
    }

    const newQuestion: QAQuestion = {
      id: this.generateId(),
      question,
      authorName: qa.allowAnonymous ? authorName : undefined,
      authorId,
      upvotes: 0,
      answered: false,
      pinnned: false,
      createdAt: new Date(),
    };

    qa.questions.push(newQuestion);
    await this.updateEmbed(embedId, qa);

    await this.prisma.interactiveResponse.create({
      data: {
        embedId,
        responseType: 'qa_question',
        data: { questionId: newQuestion.id, question },
        responderId: authorId,
      },
    });

    return newQuestion;
  }

  /**
   * Upvote a question
   */
  async upvoteQuestion(
    embedId: string,
    questionId: string,
    // _voterId?: string,
  ): Promise<QASession> {
    const embed = await this.getEmbed(embedId);
    const qa = embed.config as QASession;

    const question = qa.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    question.upvotes++;
    await this.updateEmbed(embedId, qa);

    return qa;
  }

  /**
   * Answer a question
   */
  async answerQuestion(
    embedId: string,
    questionId: string,
    answer: string,
    // _userId: string,
  ): Promise<QASession> {
    const embed = await this.getEmbed(embedId);
    const qa = embed.config as QASession;

    const question = qa.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    question.answered = true;
    question.answer = answer;
    await this.updateEmbed(embedId, qa);

    return qa;
  }

  /**
   * Create a form
   */
  async createForm(
    projectId: string,
    slideId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      fields: FormField[];
    },
  ): Promise<InteractiveEmbed> {
    const form: Form = {
      id: this.generateId(),
      title: data.title,
      description: data.description,
      fields: data.fields.map((field, idx) => ({
        ...field,
        id: field.id || `field_${idx}`,
      })),
      submissions: 0,
      isOpen: true,
    };

    return this.createEmbed(projectId, slideId, userId, 'form', form);
  }

  /**
   * Submit form response
   */
  async submitFormResponse(
    embedId: string,
    responses: Record<string, any>,
    responderId?: string,
  ): Promise<{ success: boolean; submissionId: string }> {
    const embed = await this.getEmbed(embedId);

    if (embed.type !== 'form') {
      throw new BadRequestException('Not a form embed');
    }

    const form = embed.config as Form;

    if (!form.isOpen) {
      throw new BadRequestException('Form is closed');
    }

    // Validate required fields
    for (const field of form.fields) {
      if (field.required && !responses[field.id]) {
        throw new BadRequestException(`Field "${field.label}" is required`);
      }
    }

    form.submissions++;
    await this.updateEmbed(embedId, form);

    const submission = await this.prisma.interactiveResponse.create({
      data: {
        embedId,
        responseType: 'form_submission',
        data: responses,
        responderId,
      },
    });

    return { success: true, submissionId: submission.id };
  }

  /**
   * Create a quiz
   */
  async createQuiz(
    projectId: string,
    slideId: string,
    userId: string,
    data: {
      title: string;
      questions: Omit<QuizQuestion, 'id'>[];
      showCorrectAfterSubmit?: boolean;
      timeLimit?: number;
    },
  ): Promise<InteractiveEmbed> {
    const quiz: Quiz = {
      id: this.generateId(),
      title: data.title,
      questions: data.questions.map((q, idx) => ({
        ...q,
        id: `q_${idx}`,
      })),
      showCorrectAfterSubmit: data.showCorrectAfterSubmit ?? true,
      timeLimit: data.timeLimit,
    };

    return this.createEmbed(projectId, slideId, userId, 'quiz', quiz);
  }

  /**
   * Submit quiz answers
   */
  async submitQuizAnswers(
    embedId: string,
    answers: Record<string, number>,
    responderId?: string,
  ): Promise<{
    score: number;
    totalPoints: number;
    percentage: number;
    results: Array<{
      questionId: string;
      correct: boolean;
      correctAnswer: number;
      explanation?: string;
    }>;
  }> {
    const embed = await this.getEmbed(embedId);

    if (embed.type !== 'quiz') {
      throw new BadRequestException('Not a quiz embed');
    }

    const quiz = embed.config as Quiz;
    let score = 0;
    let totalPoints = 0;
    const results: Array<{
      questionId: string;
      correct: boolean;
      correctAnswer: number;
      explanation?: string;
    }> = [];

    for (const question of quiz.questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const correct = userAnswer === question.correctAnswer;

      if (correct) {
        score += question.points;
      }

      results.push({
        questionId: question.id,
        correct,
        correctAnswer: quiz.showCorrectAfterSubmit
          ? question.correctAnswer
          : -1,
        explanation: quiz.showCorrectAfterSubmit
          ? question.explanation
          : undefined,
      });
    }

    await this.prisma.interactiveResponse.create({
      data: {
        embedId,
        responseType: 'quiz_submission',
        data: { answers, score, totalPoints },
        responderId,
      },
    });

    return {
      score,
      totalPoints,
      percentage: Math.round((score / totalPoints) * 100),
      results,
    };
  }

  /**
   * Create a word cloud
   */
  async createWordCloud(
    projectId: string,
    slideId: string,
    userId: string,
    data: {
      prompt: string;
      maxResponses?: number;
    },
  ): Promise<InteractiveEmbed> {
    const wordcloud = {
      id: this.generateId(),
      prompt: data.prompt,
      words: {} as Record<string, number>,
      maxResponses: data.maxResponses ?? 3,
      isOpen: true,
    };

    return this.createEmbed(projectId, slideId, userId, 'wordcloud', wordcloud);
  }

  /**
   * Submit word cloud words
   */
  async submitWords(
    embedId: string,
    words: string[],
    responderId?: string,
  ): Promise<Record<string, number>> {
    const embed = await this.getEmbed(embedId);
    const config = embed.config as WordCloudConfig;

    if (words.length > (config.maxResponses || 3)) {
      throw new BadRequestException(
        `Maximum ${config.maxResponses} words allowed`,
      );
    }

    for (const word of words) {
      const normalized = word.toLowerCase().trim();
      config.words[normalized] = (config.words[normalized] || 0) + 1;
    }

    await this.updateEmbed(embedId, config);

    await this.prisma.interactiveResponse.create({
      data: {
        embedId,
        responseType: 'wordcloud_submission',
        data: { words },
        responderId,
      },
    });

    return config.words;
  }

  /**
   * Get embed analytics
   */
  async getEmbedAnalytics(embedId: string): Promise<{
    totalResponses: number;
    uniqueResponders: number;
    responsesByType: Record<string, number>;
    recentActivity: Array<{
      id: string;
      responseType: string | null;
      createdAt: Date;
    }>;
  }> {
    const responses = await this.prisma.interactiveResponse.findMany({
      where: { embedId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const uniqueResponders = new Set(
      responses.filter((r) => r.responderId).map((r) => r.responderId),
    ).size;

    const responsesByType: Record<string, number> = {};
    for (const response of responses) {
      if (response.responseType) {
        responsesByType[response.responseType] =
          (responsesByType[response.responseType] || 0) + 1;
      }
    }

    return {
      totalResponses: responses.length,
      uniqueResponders,
      responsesByType,
      recentActivity: responses.slice(0, 10).map((r) => ({
        id: r.id,
        responseType: r.responseType,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Get all embeds for a slide
   */
  async getSlideEmbeds(slideId: string): Promise<InteractiveEmbed[]> {
    const embeds = await this.prisma.interactiveEmbed.findMany({
      where: { slideId },
      orderBy: { createdAt: 'asc' },
    });

    return embeds.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      slideId: e.slideId,
      type: e.type as EmbedType,
      config: e.config as unknown as
        | Poll
        | QASession
        | Form
        | Quiz
        | WordCloudConfig,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  }

  // Helper methods
  private async createEmbed(
    projectId: string,
    slideId: string,
    _userId: string,
    type: EmbedType,
    config: Poll | QASession | Form | Quiz | WordCloudConfig,
  ): Promise<InteractiveEmbed> {
    const configWithTitle = config as { title?: string; question?: string };
    const embed = await this.prisma.interactiveEmbed.create({
      data: {
        projectId,
        slideId,
        type: embedTypeToPrisma(type),
        title:
          configWithTitle.title ||
          configWithTitle.question ||
          'Interactive Embed',
        config: config as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: embed.id,
      projectId: embed.projectId,
      slideId: embed.slideId,
      type: embed.type as EmbedType,
      config: embed.config as unknown as
        | Poll
        | QASession
        | Form
        | Quiz
        | WordCloudConfig,
      createdAt: embed.createdAt,
      updatedAt: embed.updatedAt,
    };
  }

  private async getEmbed(embedId: string): Promise<InteractiveEmbed> {
    const embed = await this.prisma.interactiveEmbed.findUnique({
      where: { id: embedId },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    return {
      id: embed.id,
      projectId: embed.projectId,
      slideId: embed.slideId,
      type: embed.type as EmbedType,
      config: embed.config as unknown as
        | Poll
        | QASession
        | Form
        | Quiz
        | WordCloudConfig,
      createdAt: embed.createdAt,
      updatedAt: embed.updatedAt,
    };
  }

  private async updateEmbed(
    embedId: string,
    config: Poll | QASession | Form | Quiz | WordCloudConfig,
  ): Promise<void> {
    await this.prisma.interactiveEmbed.update({
      where: { id: embedId },
      data: { config: config as unknown as Prisma.InputJsonValue },
    });
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
