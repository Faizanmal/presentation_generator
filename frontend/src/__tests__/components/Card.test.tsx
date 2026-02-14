import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

describe('Card Components', () => {
    describe('Card', () => {
        it('renders children correctly', () => {
            render(
                <Card>
                    <div data-testid="card-child">Card content</div>
                </Card>
            );

            expect(screen.getByTestId('card-child')).toBeInTheDocument();
        });

        it('applies custom className', () => {
            render(<Card className="custom-card" data-testid="card">Content</Card>);

            const card = screen.getByTestId('card');
            expect(card).toHaveClass('custom-card');
        });

        it('forwards ref correctly', () => {
            const ref = React.createRef<HTMLDivElement>();
            render(<Card ref={ref}>Content</Card>);

            expect(ref.current).toBeInstanceOf(HTMLDivElement);
        });
    });

    describe('CardHeader', () => {
        it('renders with proper styling', () => {
            render(
                <CardHeader data-testid="header">
                    Header Content
                </CardHeader>
            );

            expect(screen.getByTestId('header')).toBeInTheDocument();
            expect(screen.getByText('Header Content')).toBeInTheDocument();
        });
    });

    describe('CardTitle', () => {
        it('renders as a heading element', () => {
            render(<CardTitle>Test Title</CardTitle>);

            expect(screen.getByText('Test Title')).toBeInTheDocument();
        });

        it('applies custom className', () => {
            render(<CardTitle className="custom-title" data-testid="title">Title</CardTitle>);

            expect(screen.getByTestId('title')).toHaveClass('custom-title');
        });
    });

    describe('CardDescription', () => {
        it('renders description text', () => {
            render(<CardDescription>This is a description</CardDescription>);

            expect(screen.getByText('This is a description')).toBeInTheDocument();
        });
    });

    describe('CardContent', () => {
        it('renders children in the content area', () => {
            render(
                <CardContent>
                    <p>Content paragraph</p>
                </CardContent>
            );

            expect(screen.getByText('Content paragraph')).toBeInTheDocument();
        });
    });

    describe('CardFooter', () => {
        it('renders footer content', () => {
            render(
                <CardFooter>
                    <button>Action</button>
                </CardFooter>
            );

            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Complete Card', () => {
        it('renders a complete card structure', () => {
            render(
                <Card data-testid="complete-card">
                    <CardHeader>
                        <CardTitle>Card Title</CardTitle>
                        <CardDescription>Card description text</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Main content area</p>
                    </CardContent>
                    <CardFooter>
                        <button>Submit</button>
                        <button>Cancel</button>
                    </CardFooter>
                </Card>
            );

            expect(screen.getByTestId('complete-card')).toBeInTheDocument();
            expect(screen.getByText('Card Title')).toBeInTheDocument();
            expect(screen.getByText('Card description text')).toBeInTheDocument();
            expect(screen.getByText('Main content area')).toBeInTheDocument();
            expect(screen.getByText('Submit')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });
    });
});
