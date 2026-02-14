export const AI_PROMPTS = {
  PRESENTATION_STRUCTURE: (
    topic: string,
    audience: string,
    tone: string,
    length: number,
  ) => `
    Generate a detailed, comprehensive outline for a presentation about "${topic}".
    Audience: ${audience}
    Tone: ${tone}
    Length: ${length} slides

    IMPORTANT REQUIREMENTS:
    - Each slide should contain RICH, DETAILED content with multiple sections
    - Include relevant emojis throughout the content to make it engaging
    - Suggest charts where data visualization would be helpful
    - Use card-style formatting for important information blocks
    - Include logos/icons suggestions where appropriate
    - Use varied text styles: headings, paragraphs, lists, callouts, quotes

    Return a JSON object with the following structure:
    {
      "title": "Presentation Title 📊",
      "subtitle": "Engaging Subtitle",
      "sections": [
        {
          "title": "Slide Title with Emoji 🎯",
          "layout": "content",
          "blocks": [
            {
              "type": "heading",
              "content": "Main Heading",
              "style": { "color": "#1a73e8", "fontSize": "32px", "emoji": "🎯" }
            },
            {
              "type": "paragraph",
              "content": "Detailed paragraph with comprehensive information...",
              "style": { "color": "#5f6368", "fontSize": "18px", "cardStyle": true }
            },
            {
              "type": "bullet-list",
              "items": ["Point 1 with emoji ✓", "Point 2 with emoji ⚡", "Point 3 with emoji 🚀"],
              "style": { "color": "#202124", "fontSize": "16px" }
            },
            {
              "type": "chart",
              "chartType": "bar",
              "title": "Data Visualization",
              "dataQuery": "search query for real-time data",
              "useRealTimeData": true
            },
            {
              "type": "card",
              "content": "Important callout or statistic",
              "style": { "backgroundColor": "#e8f0fe", "borderColor": "#1a73e8", "icon": "💡" }
            },
            {
              "type": "logo",
              "description": "Relevant company/product logo",
              "placeholder": "Logo placeholder"
            }
          ],
          "visualIdea": "Description of visual elements for this slide"
        }
      ]
    }
  `,

  SLIDE_CONTENT: (slideTitle: string, points: string[], tone: string) => `
    Write COMPREHENSIVE, DETAILED content for a slide titled "${slideTitle}".
    Key points to cover: ${points.join(', ')}
    Tone: ${tone}

    REQUIREMENTS:
    - Generate AT LEAST 5-7 content blocks per slide
    - Include relevant emojis to make content engaging
    - Use different text colors for different element types:
      * Headings: #1a73e8 (blue)
      * Paragraphs: #5f6368 (dark gray)
      * Lists: #202124 (black)
      * Highlights: #ea4335 (red)
      * Callouts: #34a853 (green)
    - Include card-style blocks for important information
    - Suggest charts where data would be helpful
    - Add logos/icons where relevant

    Return a JSON object with blocks:
    {
      "blocks": [
        {
          "type": "heading",
          "content": "Main Title 🎯",
          "style": { "color": "#1a73e8", "fontSize": "32px", "fontWeight": "bold" }
        },
        {
          "type": "subheading",
          "content": "Subtitle or Section Header 📌",
          "style": { "color": "#5f6368", "fontSize": "24px", "fontWeight": "600" }
        },
        {
          "type": "paragraph",
          "content": "Detailed paragraph explaining the concept thoroughly with multiple sentences providing context and depth...",
          "style": { "color": "#5f6368", "fontSize": "18px", "lineHeight": "1.6", "cardStyle": true }
        },
        {
          "type": "bullet-list",
          "items": [
            "First key point with emoji ✓",
            "Second key point with emoji ⚡",
            "Third key point with emoji 🚀",
            "Fourth key point with emoji 💡"
          ],
          "style": { "color": "#202124", "fontSize": "16px" }
        },
        {
          "type": "numbered-list",
          "items": [
            "Step one in the process 1️⃣",
            "Step two in the process 2️⃣",
            "Step three in the process 3️⃣"
          ],
          "style": { "color": "#202124", "fontSize": "16px" }
        },
        {
          "type": "card",
          "title": "Key Insight 💡",
          "content": "Important information in a highlighted card format",
          "style": {
            "backgroundColor": "#e8f0fe",
            "borderColor": "#1a73e8",
            "padding": "20px",
            "borderRadius": "8px"
          }
        },
        {
          "type": "quote",
          "content": "An inspiring or relevant quote",
          "author": "Author Name",
          "style": { "color": "#34a853", "fontStyle": "italic", "fontSize": "20px" }
        },
        {
          "type": "chart",
          "chartType": "bar",
          "title": "Statistical Data",
          "dataQuery": "relevant search query for real data",
          "useRealTimeData": true,
          "fallbackData": {
            "labels": ["Item 1", "Item 2", "Item 3"],
            "values": [45, 67, 82]
          }
        },
        {
          "type": "logo-grid",
          "logos": [
            { "name": "Logo 1", "description": "Company/product logo" },
            { "name": "Logo 2", "description": "Company/product logo" }
          ]
        }
      ]
    }
  `,

  ENHANCED_PRESENTATION: (
    topic: string,
    audience: string,
    tone: string,
    length: number,
    includeCharts: boolean,
    includeRealTimeData: boolean,
  ) => `
    Create a RICH, DETAILED presentation about "${topic}" with comprehensive content on each slide.
    
    Audience: ${audience}
    Tone: ${tone}
    Number of slides: ${length}
    Include charts: ${includeCharts ? 'Yes' : 'No'}
    Include real-time data: ${includeRealTimeData ? 'Yes' : 'No'}

    CRITICAL REQUIREMENTS FOR EACH SLIDE:
    1. Generate 6-10 content blocks per slide (more text and details)
    2. Use emojis throughout for visual appeal (at least 3-5 per slide)
    3. Differentiate text with colors:
       - Headings: #1a73e8 (blue, large, bold)
       - Subheadings: #5f6368 (gray, medium)
       - Paragraphs: #202124 (dark, readable)
       - Lists: #202124 with emoji bullets
       - Highlights/Callouts: #ea4335 (red) or #34a853 (green)
       - Quotes: #34a853 (green, italic)
    4. Include card-style blocks for key information
    5. Add charts with real-time data queries where relevant
    6. Suggest relevant logos/icons

    Return JSON:
    {
      "title": "Comprehensive Title with Emoji 📊",
      "subtitle": "Detailed Subtitle",
      "estimatedDuration": 10,
      "sections": [
        {
          "slideNumber": 1,
          "title": "Slide Title 🎯",
          "layout": "rich-content",
          "blocks": [
            {
              "type": "heading",
              "content": "Main Heading",
              "style": { "color": "#1a73e8", "fontSize": "36px", "fontWeight": "bold" }
            },
            {
              "type": "paragraph",
              "content": "Multiple sentences providing detailed context and explanation...",
              "style": { "color": "#5f6368", "fontSize": "18px", "cardStyle": true }
            },
            {
              "type": "bullet-list",
              "items": ["Detailed point 1 ✓", "Detailed point 2 ⚡", "Detailed point 3 🚀"],
              "style": { "color": "#202124" }
            },
            {
              "type": "card",
              "title": "Key Takeaway 💡",
              "content": "Important highlighted information",
              "style": { "backgroundColor": "#e8f0fe", "borderColor": "#1a73e8" }
            },
            {
              "type": "chart",
              "chartType": "bar",
              "title": "Data Visualization",
              "dataQuery": "search query for data",
              "useRealTimeData": ${includeRealTimeData}
            }
          ],
          "speakerNotes": "Detailed speaker notes..."
        }
      ]
    }
  `,

  CHART_DATA_CONTEXT: (chartTitle: string, topic: string) => `
    For a chart titled "${chartTitle}" in a presentation about "${topic}", 
    provide a search query to find relevant real-time data.
    
    Return JSON:
    {
      "searchQuery": "specific search query to find numerical data",
      "expectedDataPoints": 5,
      "chartType": "bar|line|pie|doughnut",
      "fallbackData": {
        "labels": ["Label 1", "Label 2", "Label 3"],
        "values": [10, 20, 30]
      }
    }
  `,
};
