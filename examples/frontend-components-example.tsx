/**
 * Frontend Integration Example: Enhanced Presentation Components
 * 
 * React components for rendering enhanced presentations with
 * charts, emojis, card styles, and rich formatting.
 */

import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ============================================
// Type Definitions
// ============================================

interface BaseBlockStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  padding?: string;
  borderRadius?: string;
  borderColor?: string;
  cardStyle?: boolean;
}

interface Block {
  type: string;
  content?: string;
  title?: string;
  items?: string[];
  icon?: string;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
  style?: BaseBlockStyle;
  chartData?: any;
  chartType?: string;
  [key: string]: any;
}

// ============================================
// Style Constants
// ============================================

const CARD_STYLES = {
  default: {
    backgroundColor: '#ffffff',
    border: '1px solid #dadce0',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.3)',
  },
  info: {
    backgroundColor: '#e8f0fe',
    border: '2px solid #1a73e8',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(60, 64, 67, 0.3)',
  },
  success: {
    backgroundColor: '#e6f4ea',
    border: '2px solid #34a853',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(60, 64, 67, 0.3)',
  },
  warning: {
    backgroundColor: '#fef7e0',
    border: '2px solid #fbbc04',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(60, 64, 67, 0.3)',
  },
  error: {
    backgroundColor: '#fce8e6',
    border: '2px solid #ea4335',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(60, 64, 67, 0.3)',
  },
};

// ============================================
// Block Components
// ============================================

export const HeadingBlock: React.FC<{ block: Block }> = ({ block }) => {
  return (
    <h1 style={block.style}>
      {block.content}
    </h1>
  );
};

export const SubheadingBlock: React.FC<{ block: Block }> = ({ block }) => {
  return (
    <h2 style={block.style}>
      {block.content}
    </h2>
  );
};

export const ParagraphBlock: React.FC<{ block: Block }> = ({ block }) => {
  const containerStyle = block.cardStyle
    ? { ...CARD_STYLES.default, ...block.style }
    : block.style;

  return (
    <div style={containerStyle}>
      <p style={{ margin: 0, ...block.style }}>
        {block.content}
      </p>
    </div>
  );
};

export const BulletListBlock: React.FC<{ block: Block }> = ({ block }) => {
  return (
    <ul style={block.style}>
      {block.items?.map((item, index) => (
        <li key={index} style={{ marginBottom: '8px' }}>
          {item}
        </li>
      ))}
    </ul>
  );
};

export const NumberedListBlock: React.FC<{ block: Block }> = ({ block }) => {
  return (
    <ol style={block.style}>
      {block.items?.map((item, index) => (
        <li key={index} style={{ marginBottom: '8px' }}>
          {item}
        </li>
      ))}
    </ol>
  );
};

export const CardBlock: React.FC<{ block: Block }> = ({ block }) => {
  const cardStyle = {
    ...CARD_STYLES[block.variant || 'default'],
    ...block.style,
  };

  return (
    <div style={cardStyle}>
      {block.icon && (
        <span style={{ fontSize: '24px', marginRight: '10px' }}>
          {block.icon}
        </span>
      )}
      {block.title && (
        <h3 style={{ margin: '0 0 10px 0', fontWeight: '600' }}>
          {block.title}
        </h3>
      )}
      <p style={{ margin: 0 }}>{block.content}</p>
    </div>
  );
};

export const QuoteBlock: React.FC<{ block: Block }> = ({ block }) => {
  return (
    <blockquote
      style={{
        borderLeft: '4px solid #34a853',
        paddingLeft: '20px',
        fontStyle: 'italic',
        color: '#34a853',
        ...block.style,
      }}
    >
      <p style={{ margin: '0 0 10px 0', fontSize: '20px' }}>
        {block.content}
      </p>
      {block.author && (
        <footer style={{ fontSize: '16px', color: '#5f6368' }}>
          — {block.author}
        </footer>
      )}
    </blockquote>
  );
};

export const ChartBlock: React.FC<{ block: Block }> = ({ block }) => {
  if (!block.chartData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#5f6368' }}>
        <p>📊 Chart data is loading...</p>
      </div>
    );
  }

  const ChartComponent = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
  }[block.chartType || 'bar'] || Bar;

  return (
    <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', ...block.style }}>
      {block.title && (
        <h3 style={{ marginTop: 0, marginBottom: '15px', textAlign: 'center' }}>
          {block.title}
        </h3>
      )}
      <div style={{ height: '300px' }}>
        <ChartComponent data={block.chartData} options={block.chartData.options || {}} />
      </div>
    </div>
  );
};

export const CalloutBlock: React.FC<{ block: Block }> = ({ block }) => {
  const cardStyle = {
    ...CARD_STYLES[block.variant || 'info'],
    display: 'flex',
    alignItems: 'flex-start',
    ...block.style,
  };

  return (
    <div style={cardStyle}>
      {block.icon && (
        <span style={{ fontSize: '24px', marginRight: '15px', flexShrink: 0 }}>
          {block.icon}
        </span>
      )}
      <div style={{ flex: 1 }}>
        {block.title && (
          <h4 style={{ margin: '0 0 8px 0', fontWeight: '600' }}>
            {block.title}
          </h4>
        )}
        <p style={{ margin: 0 }}>{block.content}</p>
      </div>
    </div>
  );
};

export const LogoBlock: React.FC<{ block: Block }> = ({ block }) => {
  return (
    <div style={{ textAlign: 'center', padding: '15px', ...block.style }}>
      {block.imageUrl ? (
        <img
          src={block.imageUrl}
          alt={block.name}
          style={{ maxWidth: '200px', maxHeight: '100px' }}
        />
      ) : (
        <div style={{ fontSize: '48px' }}>
          {block.placeholder || '🏢'}
        </div>
      )}
      <p style={{ marginTop: '10px', fontSize: '14px', color: '#5f6368' }}>
        {block.name}
      </p>
    </div>
  );
};

export const LogoGridBlock: React.FC<{ block: Block }> = ({ block }) => {
  const columns = block.columns || 3;
  
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '20px',
        padding: '20px',
        ...block.style,
      }}
    >
      {block.logos?.map((logo: any, index: number) => (
        <div key={index} style={{ textAlign: 'center' }}>
          {logo.imageUrl ? (
            <img
              src={logo.imageUrl}
              alt={logo.name}
              style={{ maxWidth: '150px', maxHeight: '80px' }}
            />
          ) : (
            <div style={{ fontSize: '36px' }}>
              {logo.placeholder || '🏢'}
            </div>
          )}
          <p style={{ marginTop: '8px', fontSize: '12px', color: '#5f6368' }}>
            {logo.name}
          </p>
        </div>
      ))}
    </div>
  );
};

// ============================================
// Block Renderer Component
// ============================================

export const BlockRenderer: React.FC<{ block: Block }> = ({ block }) => {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />;
    case 'subheading':
      return <SubheadingBlock block={block} />;
    case 'paragraph':
      return <ParagraphBlock block={block} />;
    case 'bullet-list':
      return <BulletListBlock block={block} />;
    case 'numbered-list':
      return <NumberedListBlock block={block} />;
    case 'card':
      return <CardBlock block={block} />;
    case 'quote':
      return <QuoteBlock block={block} />;
    case 'chart':
      return <ChartBlock block={block} />;
    case 'callout':
      return <CalloutBlock block={block} />;
    case 'logo':
      return <LogoBlock block={block} />;
    case 'logo-grid':
      return <LogoGridBlock block={block} />;
    default:
      return (
        <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <p style={{ color: '#80868b', fontSize: '14px' }}>
            Unsupported block type: {block.type}
          </p>
        </div>
      );
  }
};

// ============================================
// Slide Component
// ============================================

export const SlideRenderer: React.FC<{ section: any; index: number }> = ({ section, index }) => {
  return (
    <div
      style={{
        minHeight: '600px',
        padding: '40px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '20px',
      }}
    >
      <div style={{ marginBottom: '10px', color: '#80868b', fontSize: '14px' }}>
        Slide {index + 1}
      </div>
      
      <h2 style={{ marginTop: 0, marginBottom: '30px', color: '#1a73e8', fontSize: '32px' }}>
        {section.heading}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {section.blocks?.map((block: Block, blockIndex: number) => (
          <div key={blockIndex}>
            <BlockRenderer block={block} />
          </div>
        ))}
      </div>

      {section.speakerNotes && (
        <div
          style={{
            marginTop: '30px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            borderLeft: '4px solid #1a73e8',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: '#5f6368', fontStyle: 'italic' }}>
            <strong>Speaker Notes:</strong> {section.speakerNotes}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// Full Presentation Component
// ============================================

export const EnhancedPresentationViewer: React.FC<{ presentation: any }> = ({ presentation }) => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Title Slide */}
      <div
        style={{
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1a73e8',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '60px',
          marginBottom: '40px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>
          {presentation.title}
        </h1>
        {presentation.subtitle && (
          <p style={{ fontSize: '24px', margin: 0, opacity: 0.9 }}>
            {presentation.subtitle}
          </p>
        )}
      </div>

      {/* Content Slides */}
      {presentation.sections?.map((section: any, index: number) => (
        <SlideRenderer key={index} section={section} index={index} />
      ))}
    </div>
  );
};

export default EnhancedPresentationViewer;
