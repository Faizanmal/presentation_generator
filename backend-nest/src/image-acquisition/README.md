# Image Acquisition System

Automated image acquisition service for Presentation Designer that supports multiple sources:
- **AI Generation**: DALL-E 3 for custom image creation
- **Stock Photos**: Unsplash, Pexels, Pixabay (all license-free)
- **Direct URLs**: Download from any public URL

## Features

✅ **Multiple Image Sources**
- AI-generated images via OpenAI DALL-E 3
- Free stock photos from 3 major providers
- Direct URL downloads

✅ **Smart Acquisition**
- Automatically tries multiple sources if one fails
- Keyword extraction for topic-based searches
- Bulk acquisition for presentations

✅ **Background Processing**
- Queue-based async image acquisition
- Progress tracking with job IDs
- Automatic retry on failures

✅ **Auto-Integration**
- Automatically add images to slides
- Create new slides with acquired images
- Save metadata (author, license, source)

✅ **Production Ready**
- Concurrent processing (3 images at once)
- Error handling and fallbacks
- Auto-cleanup of old images

## Setup

### 1. Install Dependencies

Already included in main package.json:
- `openai` - For DALL-E integration
- `axios` - For HTTP requests
- `@nestjs/bullmq` - For background jobs

### 2. Environment Variables

Add to `.env`:

```env
# AI Image Generation
OPENAI_API_KEY=sk-...

# Stock Photo APIs (all free with registration)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
PEXELS_API_KEY=your_pexels_api_key
PIXABAY_API_KEY=your_pixabay_api_key

# Upload directory
UPLOAD_DIR=./uploads/acquired-images
```

### 3. Get Free API Keys

**Unsplash** (50 requests/hour free):
1. Go to https://unsplash.com/developers
2. Register your application
3. Copy the "Access Key"

**Pexels** (200 requests/hour free):
1. Go to https://www.pexels.com/api/
2. Sign up and create API key
3. Copy the API key

**Pixabay** (100 requests/minute free):
1. Go to https://pixabay.com/api/docs/
2. Sign up and get API key
3. Copy the API key

**OpenAI** (for AI generation):
1. Go to https://platform.openai.com/api-keys
2. Create new API key
3. Add credits to your account

### 4. Register Module

Add to `app.module.ts`:

```typescript
import { ImageAcquisitionModule } from './image-acquisition/image-acquisition.module';

@Module({
  imports: [
    // ... other imports
    ImageAcquisitionModule,
  ],
})
export class AppModule {}
```

## API Usage

### 1. Acquire Single Image (Synchronous)

```bash
POST /api/image-acquisition/acquire
Authorization: Bearer <token>

{
  "source": "unsplash",
  "query": "business presentation",
  "orientation": "landscape",
  "projectId": "project-123",
  "slideId": "slide-456",
  "autoAdd": true
}
```

**Sources**:
- `ai` - Requires `prompt` field
- `unsplash` - Requires `query` field
- `pexels` - Requires `query` field
- `pixabay` - Requires `query` field
- `url` - Requires `url` field

**Response**:
```json
{
  "success": true,
  "image": {
    "id": "img-1234567890-abc",
    "source": "unsplash",
    "url": "https://...",
    "localPath": "/uploads/acquired-images/unsplash-...",
    "width": 1920,
    "height": 1080,
    "description": "Business meeting in modern office",
    "author": "John Doe",
    "license": "Unsplash License (Free to use)"
  }
}
```

### 2. Acquire Single Image (Asynchronous)

```bash
POST /api/image-acquisition/acquire-async
{
  "source": "ai",
  "prompt": "A modern minimalist office workspace",
  "projectId": "project-123",
  "autoAdd": true
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "12345",
  "message": "Image acquisition queued"
}
```

### 3. Smart Acquire (Auto-Fallback)

Tries multiple sources automatically:

```bash
POST /api/image-acquisition/smart-acquire
{
  "query": "data visualization",
  "projectId": "project-123",
  "orientation": "landscape"
}
```

### 4. Bulk Acquire for Topic

Acquire multiple images at once:

```bash
POST /api/image-acquisition/bulk-acquire
{
  "topic": "artificial intelligence machine learning technology",
  "count": 5,
  "projectId": "project-123",
  "autoCreateSlides": true
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "67890",
  "message": "Queued acquisition of 5 images"
}
```

### 5. Check Job Status

```bash
GET /api/image-acquisition/job/12345
```

**Response**:
```json
{
  "success": true,
  "job": {
    "id": "12345",
    "state": "completed",
    "progress": 100,
    "result": { /* acquired image */ }
  }
}
```

### 6. Get Available Sources

```bash
GET /api/image-acquisition/sources
```

**Response**:
```json
{
  "success": true,
  "sources": [
    {
      "id": "ai",
      "name": "AI Generation (DALL-E)",
      "available": true,
      "requiresPrompt": true
    },
    {
      "id": "unsplash",
      "name": "Unsplash",
      "available": true,
      "license": "Free to use"
    }
  ]
}
```

### 7. Test Configuration

```bash
POST /api/image-acquisition/test?source=unsplash
```

## Frontend Integration

### Example: React Component

```typescript
import { useState } from 'react';

function ImageAcquisition({ projectId, slideId }) {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

  const acquireImage = async (source: string, query: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/image-acquisition/acquire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          source,
          query,
          projectId,
          slideId,
          orientation: 'landscape',
          autoAdd: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setImage(data.image);
        alert('Image added to slide!');
      }
    } catch (error) {
      console.error('Failed to acquire image:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Add Images from...</h3>
      <button onClick={() => acquireImage('unsplash', 'business')}>
        Unsplash
      </button>
      <button onClick={() => acquireImage('pexels', 'technology')}>
        Pexels
      </button>
      <button onClick={() => acquireImage('ai', 'modern office')}>
        AI Generate
      </button>
      {loading && <p>Acquiring image...</p>}
      {image && <img src={image.url} alt={image.description} />}
    </div>
  );
}
```

### Example: Bulk Acquisition

```typescript
async function bulkAcquireForPresentation(topic: string) {
  const response = await fetch('/api/image-acquisition/bulk-acquire', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      topic,
      count: 5,
      projectId: 'project-123',
      autoCreateSlides: true,
    }),
  });

  const { jobId } = await response.json();

  // Poll for completion
  const interval = setInterval(async () => {
    const status = await fetch(`/api/image-acquisition/job/${jobId}`);
    const { job } = await status.json();

    if (job.state === 'completed') {
      clearInterval(interval);
      alert(`Acquired ${job.result.length} images!`);
    } else if (job.state === 'failed') {
      clearInterval(interval);
      alert('Failed to acquire images');
    }
  }, 2000);
}
```

## Use Cases

### 1. Auto-Populate Presentation

```typescript
// Acquire images for each slide topic
const slides = [
  { title: 'Introduction', keywords: 'business meeting' },
  { title: 'Market Analysis', keywords: 'data charts graphs' },
  { title: 'Our Solution', keywords: 'technology innovation' },
];

for (const slide of slides) {
  await acquireAndAddImage(slide.keywords, slide.id);
}
```

### 2. AI Image Generation

```typescript
// Generate custom images for specific needs
await acquireImage({
  source: 'ai',
  prompt: 'A modern dashboard showing analytics and metrics, clean design, professional',
  projectId: 'project-123',
});
```

### 3. Theme-Based Image Collection

```typescript
// Get multiple images for a presentation theme
await bulkAcquire({
  topic: 'sustainability green energy environment',
  count: 10,
  autoCreateSlides: false, // Just acquire, don't create slides
});
```

## Performance

- **Concurrent Processing**: 3 images acquired simultaneously
- **Smart Caching**: Downloaded images saved locally
- **Auto-Cleanup**: Old images deleted after 7 days
- **Retry Logic**: 3 attempts with exponential backoff
- **Rate Limits**: Respects API rate limits

## Cost Estimates

**Free Tier Limits**:
- Unsplash: 50 requests/hour
- Pexels: 200 requests/hour
- Pixabay: 100 requests/minute
- OpenAI DALL-E: ~$0.04 per image (1024x1024)

**Recommended for Production**:
- Use stock photos for general content (free)
- Use AI generation only for custom/specific needs
- Implement user-facing rate limits
- Cache frequently requested images

## Security

✅ **API Key Protection**
- All keys stored in environment variables
- Never exposed to frontend

✅ **User Authorization**
- JWT authentication required
- Project ownership verified

✅ **Rate Limiting**
- Per-user acquisition limits
- Queue-based throttling

✅ **License Compliance**
- Metadata saved with each image
- Attribution information stored

## Troubleshooting

### API Key Not Working

```bash
# Test each source
curl -X POST http://localhost:3000/api/image-acquisition/test?source=unsplash \
  -H "Authorization: Bearer <token>"
```

### Images Not Downloading

Check upload directory permissions:
```bash
mkdir -p ./uploads/acquired-images
chmod 755 ./uploads/acquired-images
```

### Job Stuck in Queue

Check Redis connection and BullMQ dashboard:
```bash
# BullMQ Board (install globally)
npm install -g bull-board
bull-board
```

### Rate Limit Exceeded

Wait for rate limit reset or upgrade API plan:
- Unsplash: Upgrade to paid plan for 5000 req/hour
- Pexels: Contact for enterprise plan
- Pixabay: No paid upgrade (100/minute max)

## Future Enhancements

- [ ] Integration with more stock photo sites (Flickr, etc.)
- [ ] Image search by similarity/reverse image search
- [ ] Automatic image optimization (compression, resize)
- [ ] Image editing capabilities (crop, filter, overlay text)
- [ ] Brand library for company-specific images
- [ ] AI-powered image selection based on slide content
- [ ] Video acquisition support
- [ ] GIF and animation support

## License Attribution

This service helps you use license-free images legally. Each acquired image includes:
- Source and license information
- Author attribution
- Direct link to original

Always review and comply with each platform's license terms.
