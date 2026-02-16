import { render, screen, fireEvent } from '@testing-library/react';
import BlockRenderer from '@/components/editor/BlockRenderer';
import type { Block, BlockType } from '@/types';

// Mock dependencies
jest.mock('@dnd-kit/sortable', () => ({
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: jest.fn(),
        transform: null,
        transition: null,
        isDragging: false,
    }),
}));

jest.mock('@dnd-kit/utilities', () => ({
    CSS: {
        Transform: {
            toString: jest.fn(),
        },
    },
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt || ''} />,
}));

jest.mock('lucide-react', () => ({
    GripVertical: () => <div data-testid="grip-icon" />,
    Trash2: () => <div data-testid="trash-icon" />,
    MoreHorizontal: () => <div data-testid="more-icon" />,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <div data-testid="dropdown-item" onClick={onClick}>
            {children}
        </div>
    ),
}));

jest.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/editor/chart-block', () => ({
    ChartBlock: () => <div data-testid="chart-block" />,
}));

describe('BlockRenderer', () => {
    const mockHandlers = {
        onFocus: jest.fn(),
        onBlur: jest.fn(),
        onChange: jest.fn(),
        onDelete: jest.fn(),
    };

    const baseBlock: Block = {
        id: 'block-1',
        projectId: 'project-1',
        slideId: 'slide-1',
        content: { text: 'Test Content' },
        type: 'PARAGRAPH' as BlockType,
        blockType: 'PARAGRAPH' as BlockType,
        order: 0,
        style: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders a paragraph block', () => {
        render(
            <BlockRenderer
                block={baseBlock}
                isActive={false}
                {...mockHandlers}
            />
        );

        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders a heading block', () => {
        const headingBlock = {
            ...baseBlock,
            type: 'HEADING' as BlockType,
            blockType: 'HEADING' as BlockType,
            content: { text: 'My Heading' },
        };

        render(
            <BlockRenderer
                block={headingBlock}
                isActive={false}
                {...mockHandlers}
            />
        );

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('My Heading');
    });

    it('renders a subheading block', () => {
        const headingBlock = {
            ...baseBlock,
            type: 'SUBHEADING' as BlockType,
            blockType: 'SUBHEADING' as BlockType,
            content: { text: 'My Subheading' },
        };

        render(
            <BlockRenderer
                block={headingBlock}
                isActive={false}
                {...mockHandlers}
            />
        );

        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent('My Subheading');
    });

    it('renders a bullet list', () => {
        const listBlock = {
            ...baseBlock,
            type: 'BULLET_LIST' as BlockType,
            blockType: 'BULLET_LIST' as BlockType,
            content: { items: ['Item 1', 'Item 2'] },
        };

        render(
            <BlockRenderer
                block={listBlock}
                isActive={false}
                {...mockHandlers}
            />
        );

        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        // list-disc class indicates bullet points
        expect(screen.getByRole('list')).toHaveClass('list-disc');
    });

    it('renders an image with URL', () => {
        const imageBlock = {
            ...baseBlock,
            type: 'IMAGE' as BlockType,
            blockType: 'IMAGE' as BlockType,
            content: { url: 'https://example.com/image.png', alt: 'Test Image' },
        };

        render(
            <BlockRenderer
                block={imageBlock}
                isActive={false}
                {...mockHandlers}
            />
        );

        const img = screen.getByAltText('Test Image');
        expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    });

    it('renders image placeholder when no URL', () => {
        const imageBlock = {
            ...baseBlock,
            type: 'IMAGE' as BlockType,
            blockType: 'IMAGE' as BlockType,
            content: { url: '', alt: '' },
        };

        render(
            <BlockRenderer
                block={imageBlock}
                isActive={false}
                {...mockHandlers}
            />
        );

        expect(screen.getByText('Click to add image')).toBeInTheDocument();
    });

    it('calls onChange when content is edited (debounced)', async () => {
        jest.useFakeTimers();

        render(
            <BlockRenderer
                block={baseBlock}
                isActive
                {...mockHandlers}
            />
        );

        const paragraph = screen.getByText('Test Content');

        // Simulate content editable change
        fireEvent.input(paragraph, { target: { innerText: 'New Content' } });

        // Should not be called immediately
        expect(mockHandlers.onChange).not.toHaveBeenCalled();

        // Fast-forward debounce time
        jest.advanceTimersByTime(500);

        expect(mockHandlers.onChange).toHaveBeenCalledWith(
            expect.objectContaining({ text: 'New Content' })
        );

        jest.useRealTimers();
    });

    it('shows delete option in dropdown', () => {
        render(
            <BlockRenderer
                block={baseBlock}
                isActive
                {...mockHandlers}
            />
        );

        expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
        // In our mock, content is always rendered, but in reality it would be hidden until trigger
        // Since we mocked Radix UI primitives simply, we can find the delete item directly

        const deleteBtn = screen.getByTestId('dropdown-item');
        fireEvent.click(deleteBtn);

        expect(mockHandlers.onDelete).toHaveBeenCalled();
    });

    it('applies active styling when isActive is true', () => {
        const { container } = render(
            <BlockRenderer
                block={baseBlock}
                isActive
                {...mockHandlers}
            />
        );

        // The parent div should have ring classes
        // We look for the first div in container which matches our component root
        const rootDiv = container.firstChild as HTMLElement;
        expect(rootDiv).toHaveClass('ring-2');
        expect(rootDiv).toHaveClass('ring-blue-500');
    });
});
