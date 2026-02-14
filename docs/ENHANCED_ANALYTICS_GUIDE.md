# Enhanced Analytics Features - Usage Guide

## Overview

The PresentationDesigner now includes comprehensive AI-powered analytics features that were previously missing from the dashboard. This guide covers all the new capabilities.

## New Features Added

### 1. **Structured AI Insights** ✨
- Type-based insights (improvement, warning, tip, success)
- Priority levels (high, medium, low)
- Actionable recommendations with implementation steps
- Expected impact metrics

### 2. **Real-Time Data Integration** 📊
- Live viewer tracking
- 30-second refresh intervals
- Active viewers count
- Hourly and daily view metrics
- Engagement rate calculations

### 3. **Predictive Analytics** 🔮
- 30-day view forecasts
- Trend analysis (growing, declining, stable)
- Confidence scoring
- Projected growth percentages
- Linear regression-based predictions

### 4. **Advanced Audience Segmentation** 👥
- Device distribution (mobile, tablet, desktop)
- Browser analytics
- Engagement level breakdown
- AI-generated audience insights

### 5. **Content Optimization** 🎯
- Slide-specific improvement suggestions
- AI-powered issue detection
- Priority-based recommendations
- Expected impact analysis

### 6. **Advanced Chart Generation** 📈
- Real-time data integration
- AI-powered chart creation
- Multiple chart types (bar, line, pie, doughnut)
- Auto-refresh capabilities

## Backend API Endpoints

### Analytics Endpoints

```typescript
// Get structured AI insights
GET /analytics/:projectId/ai-insights/structured

// Get predictive analytics
GET /analytics/:projectId/predictive?days=30

// Get real-time metrics
GET /analytics/:projectId/real-time

// Get audience segments
GET /analytics/:projectId/audience-segments

// Get content optimization suggestions
POST /analytics/:projectId/optimize-content
{
  "slideId": "optional-slide-id"
}
```

### AI Chart Generation

```typescript
// Generate chart with real-time data
POST /ai/generate-chart-data
{
  "title": "Market Growth 2025",
  "topic": "SaaS market trends",
  "chartType": "bar",
  "useRealTimeData": true,
  "projectId": "project-id"
}
```

## Frontend Components

### EnhancedAnalyticsDashboard

The main dashboard component with all features integrated:

```tsx
import { EnhancedAnalyticsDashboard } from '@/components/analytics';

function MyProjectPage({ projectId }: { projectId: string }) {
  return <EnhancedAnalyticsDashboard projectId={projectId} />;
}
```

### Individual Components

```tsx
import {
  AdvancedChartGenerator,
  RealTimeChart,
  AnalyticsChartsGrid,
} from '@/components/analytics';

// AI Chart Generator
<AdvancedChartGenerator
  projectId={projectId}
  onChartGenerated={(data) => console.log('Chart generated:', data)}
/>

// Real-time view chart
<RealTimeChart
  projectId={projectId}
  chartType="views"
  refreshInterval={30000} // 30 seconds
/>

// Complete charts grid
<AnalyticsChartsGrid projectId={projectId} />
```

## API Client Methods

New methods added to `@/lib/api.ts`:

```typescript
// Structured insights
const insights = await api.getStructuredInsights(projectId);

// Predictive analytics
const predictions = await api.getPredictiveAnalytics(projectId, 30);

// Real-time metrics
const realTime = await api.getRealTimeMetrics(projectId);

// Audience segments
const audience = await api.getAudienceSegments(projectId);

// Content optimization
const optimization = await api.getContentOptimization(projectId);
```

## TypeScript Types

All new types are available in `@/types`:

```typescript
import type {
  AIInsight,
  StructuredInsightsResponse,
  PredictiveAnalytics,
  RealTimeMetrics,
  AudienceSegments,
  ContentOptimization,
} from '@/types';

// Example: Using structured insights
const insights: AIInsight[] = data.insights;
insights.forEach((insight) => {
  console.log(`${insight.priority}: ${insight.title}`);
  console.log(`Type: ${insight.type}`);
  console.log(`Actionable: ${insight.actionable}`);
});
```

## React Query Integration

All components use React Query for data fetching with automatic:
- Caching
- Background refetching
- Error handling
- Loading states

Example custom hook:

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function useEnhancedAnalytics(projectId: string) {
  const insights = useQuery({
    queryKey: ['structured-insights', projectId],
    queryFn: () => api.getStructuredInsights(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const predictive = useQuery({
    queryKey: ['predictive', projectId],
    queryFn: () => api.getPredictiveAnalytics(projectId, 30),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const realTime = useQuery({
    queryKey: ['realtime', projectId],
    queryFn: () => api.getRealTimeMetrics(projectId),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return { insights, predictive, realTime };
}
```

## Backend Service Usage

### Analytics Service

```typescript
import { AnalyticsService } from './analytics/analytics.service';

// In your controller or service
const insights = await analyticsService.getStructuredInsights(projectId);
const predictions = await analyticsService.getPredictiveAnalytics(projectId, 30);
const realTime = await analyticsService.getRealTimeMetrics(projectId);
const segments = await analyticsService.getAudienceSegments(projectId);
const optimization = await analyticsService.getContentOptimization(projectId);
```

### AI Service Integration

```typescript
import { AIService } from './ai/ai.service';

// Generate analytics insights with AI
const structuredInsights = await aiService.generateAnalyticsInsights({
  totalViews: 1000,
  uniqueViews: 750,
  averageDuration: 120,
  completionRate: 0.85,
  dropOffSlide: 3,
  topSlides: [
    { slideIndex: 0, averageDuration: 150, viewCount: 900 },
    { slideIndex: 1, averageDuration: 130, viewCount: 850 },
  ],
  totalSlides: 10,
});

// Generate chart with real-time data
const chartData = await aiService.generateChartWithRealData(
  'Market Growth',
  'SaaS industry trends',
  'bar'
);
```

## Migration Guide

### From Old Dashboard to Enhanced Dashboard

**Before:**
```tsx
import { AnalyticsDashboard } from '@/components/editor/analytics-dashboard';

<AnalyticsDashboard projectId={projectId} />
```

**After:**
```tsx
import { EnhancedAnalyticsDashboard } from '@/components/analytics';

<EnhancedAnalyticsDashboard projectId={projectId} />
```

The new dashboard includes all features from the old one plus:
- ✅ Structured AI insights
- ✅ Real-time metrics banner
- ✅ Predictive analytics
- ✅ Audience segmentation
- ✅ Content optimization recommendations

### Backward Compatibility

All old components remain available:
- `AnalyticsDashboard` - Basic analytics
- `AdvancedAnalyticsDashboard` - Mid-level analytics
- `InsightsDashboard` - AI insights only
- `AudienceAnalyticsDashboard` - Audience-specific

## Performance Considerations

### Caching Strategy

- **Structured insights**: 5-minute stale time
- **Predictive analytics**: 10-minute stale time
- **Real-time metrics**: 30-second refresh interval
- **Audience segments**: 5-minute stale time
- **Content optimization**: 10-minute stale time

### Rate Limiting

The backend implements rate limiting for AI-powered endpoints:
- Max 10 AI generations per minute per user
- Cached results served when available
- Fallback to rule-based insights if AI fails

### Database Optimization

- Indexed queries for fast analytics retrieval
- Daily aggregation cron job for historical data
- Efficient slide performance calculations

## Troubleshooting

### Common Issues

**1. "Insufficient data" message**
- Ensure at least 7 days of viewing data
- Check that presentation has been shared publicly
- Verify tracking is enabled

**2. Real-time metrics not updating**
- Check network connectivity
- Verify 30-second refresh interval
- Check browser console for errors

**3. AI insights not generating**
- Verify AI API keys are configured
- Check user's AI generation quota
- Review server logs for errors

**4. Charts not rendering**
- Ensure Chart.js is installed: `npm install chart.js react-chartjs-2`
- Verify canvas element in DOM
- Check browser console for errors

## Best Practices

1. **Use structured insights for actionable feedback**
   ```tsx
   insights.filter(i => i.actionable && i.priority === 'high')
   ```

2. **Monitor real-time metrics for live presentations**
   ```tsx
   <RealTimeChart projectId={id} refreshInterval={30000} />
   ```

3. **Leverage predictive analytics for planning**
   ```tsx
   if (predictions.trend === 'declining') {
     // Alert user to promote content
   }
   ```

4. **Segment audiences for targeted improvements**
   ```tsx
   const mobileUsers = (audience.devices.mobile / audience.totalAudience) * 100;
   if (mobileUsers > 50) {
     // Optimize for mobile
   }
   ```

5. **Apply content optimization suggestions**
   ```tsx
   const highPriority = optimization.suggestions.filter(s => s.priority === 'high');
   // Display these prominently to user
   ```

## Support

For issues or questions:
- Check the TypeScript types for API contracts
- Review component props in source files
- Check backend logs for AI service errors
- Verify database migrations are up to date

## Future Enhancements

Planned features:
- A/B testing integration
- Custom metric definitions
- Export to PowerPoint with insights
- Automated presentation improvements
- Natural language query interface
