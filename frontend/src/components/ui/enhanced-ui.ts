// Enhanced UI Components - exports all new UI components

// Animations
export {
    FadeInUp,
    StaggerContainer,
    StaggerItem,
    ScaleOnHover,
    FloatingElement,
    TypewriterText,
    SlideIn,
    PulseAnimation,
    AnimatedCounter,
    ShimmerEffect,
    GlowOnHover,
} from "./animations";

// Animated gradient background
export { AnimatedGradient } from "./animated-gradient";

// Notifications system
export {
    NotificationProvider,
    useNotifications,
    NotificationBell,
    ToastProvider,
    useToast,
} from "./notifications";
export type { NotificationType, Notification } from "./notifications";

// Skeleton loaders
export {
    Skeleton,
    SkeletonText,
    SkeletonCard,
    SkeletonAvatar,
    SkeletonButton,
    SkeletonList,
    SkeletonTable,
    SkeletonDashboard,
    SkeletonEditor,
    ShimmerOverlay,
    PageLoading,
    LoadingSpinner,
} from "./skeleton-loaders";

// Onboarding wizard
export {
    OnboardingWizard,
    useOnboarding,
} from "./onboarding-wizard";
export type { OnboardingData } from "./onboarding-wizard";

// Dashboard widgets
export {
    StatCard,
    QuickActionCard,
    StatsGrid,
    QuickActionsGrid,
    ActivityFeed,
    UsageProgress,
    UsageCard,
} from "./dashboard-widgets";

// Feature tour
export {
    FeatureTour,
    useFeatureTour,
    dashboardTourSteps,
    editorTourSteps,
} from "./feature-tour";
export type { TourStep } from "./feature-tour";

// Empty states
export {
    EmptyState,
    IllustratedEmptyState,
    ComingSoon,
} from "./empty-states";

// Theme toggle
export {
    useTheme,
    ThemeToggle,
    ThemeToggleSimple,
    ThemeSwitch,
} from "./theme-toggle";

// AI Chat panel
export {
    AIChatPanel,
    AIAssistButton,
} from "./ai-chat-panel";

// Project card
export {
    ProjectCard,
    CreateProjectCard,
} from "./project-card";

// Celebration & gamification
export {
    Confetti,
    useConfetti,
    CelebrationModal,
    AchievementBadge,
    PointsAnimation,
} from "./celebration";
