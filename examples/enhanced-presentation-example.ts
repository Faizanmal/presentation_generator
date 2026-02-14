/**
 * Example: Generate Enhanced Presentation with Charts, Emojis, and Rich Content
 * 
 * This example demonstrates how to use the enhanced presentation generation
 * features including real-time data, charts, emojis, and card-style blocks.
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'your_jwt_token_here';

// Create axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Example 1: Generate a comprehensive enhanced presentation
 */
async function generateEnhancedPresentation() {
  try {
    const response = await api.post('/ai/generate-enhanced', {
      topic: 'Artificial Intelligence in Healthcare',
      tone: 'professional',
      audience: 'healthcare executives and investors',
      length: 10,
      includeCharts: true,
      includeRealTimeData: true,
      includeEmojis: true,
      generateImages: true,
      imageSource: 'ai',
    });

    console.log('✅ Enhanced Presentation Generated!');
    console.log('Title:', response.data.presentation.title);
    console.log('Sections:', response.data.presentation.sections.length);
    
    // Display first section details
    const firstSection = response.data.presentation.sections[0];
    console.log('\n📊 First Section:');
    console.log('Heading:', firstSection.heading);
    console.log('Layout:', firstSection.layout);
    console.log('Blocks:', firstSection.blocks.length);
    
    // Display block types
    console.log('\n🎨 Block Types in First Section:');
    firstSection.blocks.forEach((block: any, index: number) => {
      console.log(`  ${index + 1}. ${block.type} - ${block.content?.substring(0, 50) || block.title || 'N/A'}...`);
    });

    return response.data.presentation;
  } catch (error) {
    console.error('❌ Error generating presentation:', error);
    throw error;
  }
}

/**
 * Example 2: Generate a specific chart with real-time data
 */
async function generateChartWithRealData() {
  try {
    const response = await api.post('/ai/generate-chart', {
      title: 'Global AI Market Growth',
      topic: 'artificial intelligence market size by year',
      chartType: 'bar',
    });

    console.log('✅ Chart Generated with Real-Time Data!');
    console.log('Chart Type:', response.data.chartData.type);
    console.log('Labels:', response.data.chartData.labels);
    console.log('Data:', response.data.chartData.datasets[0].data);

    return response.data.chartData;
  } catch (error) {
    console.error('❌ Error generating chart:', error);
    throw error;
  }
}

/**
 * Example 3: Search for real-time data
 */
async function searchRealTimeData() {
  try {
    const response = await api.post('/ai/search-realtime-data', {
      query: 'healthcare AI market statistics 2024',
      limit: 5,
    });

    console.log('✅ Real-Time Data Retrieved!');
    console.log('Query:', response.data.data.query);
    console.log('Results:', response.data.data.results.length);
    
    response.data.data.results.forEach((result: any, index: number) => {
      console.log(`\n📄 Result ${index + 1}:`);
      console.log('  Title:', result.title);
      console.log('  Snippet:', result.snippet.substring(0, 100) + '...');
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Error searching data:', error);
    throw error;
  }
}

/**
 * Example 4: Extract chart data from search results
 */
async function extractChartData() {
  try {
    const response = await api.post('/ai/extract-chart-data', {
      query: 'top 5 AI companies by revenue',
      dataPoints: 5,
    });

    console.log('✅ Chart Data Extracted!');
    response.data.chartData.forEach((point: any) => {
      console.log(`  ${point.label}: ${point.value}`);
    });

    return response.data.chartData;
  } catch (error) {
    console.error('❌ Error extracting chart data:', error);
    throw error;
  }
}

/**
 * Example 5: Add emojis to text content
 */
async function addEmojisToText() {
  try {
    const response = await api.post('/ai/add-emojis', {
      text: 'Welcome to our presentation about AI in Healthcare. We will discuss market trends, key technologies, and future opportunities.',
      context: 'professional healthcare presentation',
    });

    console.log('✅ Emojis Added!');
    console.log('Original:', response.data.original);
    console.log('Enhanced:', response.data.text);

    return response.data.text;
  } catch (error) {
    console.error('❌ Error adding emojis:', error);
    throw error;
  }
}

/**
 * Example 6: Get topic statistics
 */
async function getTopicStatistics() {
  try {
    const response = await api.post('/ai/topic-statistics', {
      topic: 'artificial intelligence healthcare',
    });

    console.log('✅ Topic Statistics Retrieved!');
    console.log('Topic:', response.data.statistics.topic);
    console.log('Summary:', response.data.statistics.summary);
    console.log('Search Results:', response.data.statistics.searchResults.length);

    return response.data.statistics;
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    throw error;
  }
}

/**
 * Example 7: Create a presentation with custom styled blocks
 */
async function createPresentationWithStyledBlocks() {
  const presentation = {
    title: 'AI Healthcare Revolution 🏥',
    sections: [
      {
        heading: 'Market Overview 📊',
        layout: 'rich-content',
        blocks: [
          {
            type: 'heading',
            content: 'Healthcare AI Market 2024 🎯',
            style: {
              color: '#1a73e8',
              fontSize: '36px',
              fontWeight: 'bold',
            },
          },
          {
            type: 'paragraph',
            content: 'The healthcare AI market is experiencing unprecedented growth, driven by advances in machine learning, increased data availability, and growing demand for personalized medicine.',
            cardStyle: true,
            style: {
              color: '#5f6368',
              fontSize: '18px',
              lineHeight: '1.6',
            },
          },
          {
            type: 'bullet-list',
            items: [
              'Market size: $15.1B in 2024 ✓',
              'Expected CAGR: 37.5% (2024-2030) ⚡',
              'Key applications: Diagnostics, Drug Discovery, Patient Care 🚀',
              'Major players: Google Health, IBM Watson, Microsoft 💡',
            ],
            style: {
              color: '#202124',
              fontSize: '16px',
            },
          },
          {
            type: 'chart',
            chartType: 'bar',
            title: 'Healthcare AI Market Growth',
            dataQuery: 'healthcare AI market size by year',
            useRealTimeData: true,
          },
          {
            type: 'card',
            title: 'Key Insight 💡',
            content: 'AI-powered diagnostic tools are achieving 95%+ accuracy rates, surpassing human experts in specific domains like radiology and pathology.',
            icon: '💡',
            variant: 'success',
          },
          {
            type: 'callout',
            title: 'Investment Opportunity ⚠️',
            content: 'Healthcare AI startups raised $8.7B in venture capital in 2023, a 45% increase from the previous year.',
            variant: 'warning',
            icon: '📈',
          },
        ],
        speakerNotes: 'Start by highlighting the explosive growth in healthcare AI. Emphasize the market size and growth rate. Point out the key applications and major players. Use the chart to visualize the trend.',
      },
    ],
  };

  console.log('📋 Custom Styled Presentation Structure:');
  console.log(JSON.stringify(presentation, null, 2));

  return presentation;
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Starting Enhanced Presentation Examples\n');
  console.log('=' .repeat(60));

  try {
    // Example 1: Generate enhanced presentation
    console.log('\n📝 Example 1: Generate Enhanced Presentation');
    console.log('-'.repeat(60));
    await generateEnhancedPresentation();

    // Example 2: Generate chart
    console.log('\n📊 Example 2: Generate Chart with Real-Time Data');
    console.log('-'.repeat(60));
    await generateChartWithRealData();

    // Example 3: Search real-time data
    console.log('\n🔍 Example 3: Search Real-Time Data');
    console.log('-'.repeat(60));
    await searchRealTimeData();

    // Example 4: Extract chart data
    console.log('\n📈 Example 4: Extract Chart Data');
    console.log('-'.repeat(60));
    await extractChartData();

    // Example 5: Add emojis
    console.log('\n😊 Example 5: Add Emojis to Text');
    console.log('-'.repeat(60));
    await addEmojisToText();

    // Example 6: Get statistics
    console.log('\n📊 Example 6: Get Topic Statistics');
    console.log('-'.repeat(60));
    await getTopicStatistics();

    // Example 7: Custom styled blocks
    console.log('\n🎨 Example 7: Custom Styled Blocks');
    console.log('-'.repeat(60));
    createPresentationWithStyledBlocks();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Examples failed:', error);
  }
}

// Export functions for use in other modules
export {
  generateEnhancedPresentation,
  generateChartWithRealData,
  searchRealTimeData,
  extractChartData,
  addEmojisToText,
  getTopicStatistics,
  createPresentationWithStyledBlocks,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}
