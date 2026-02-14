import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge Component', () => {
    it('renders with default variant', () => {
        render(<Badge>Default Badge</Badge>);

        expect(screen.getByText('Default Badge')).toBeInTheDocument();
    });

    it('renders with different variants', () => {
        const { rerender } = render(<Badge variant="default">Default</Badge>);
        expect(screen.getByText('Default')).toBeInTheDocument();

        rerender(<Badge variant="secondary">Secondary</Badge>);
        expect(screen.getByText('Secondary')).toBeInTheDocument();

        rerender(<Badge variant="destructive">Destructive</Badge>);
        expect(screen.getByText('Destructive')).toBeInTheDocument();

        rerender(<Badge variant="outline">Outline</Badge>);
        expect(screen.getByText('Outline')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<Badge className="custom-badge" data-testid="badge">Custom</Badge>);

        const badge = screen.getByTestId('badge');
        expect(badge).toHaveClass('custom-badge');
    });

    it('renders children correctly', () => {
        render(
            <Badge>
                <span data-testid="child">Badge Content</span>
            </Badge>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});
