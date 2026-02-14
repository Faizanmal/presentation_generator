import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
    it('renders with default props', () => {
        render(<Button>Click me</Button>);

        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
    });

    it('renders with different variants', () => {
        const { rerender } = render(<Button variant="default">Default</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button variant="destructive">Destructive</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button variant="outline">Outline</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button variant="secondary">Secondary</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button variant="ghost">Ghost</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button variant="link">Link</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
        const { rerender } = render(<Button size="default">Default Size</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button size="sm">Small Size</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button size="lg">Large Size</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();

        rerender(<Button size="icon">Icon</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles click events', () => {
        const handleClick = jest.fn();
        render(<Button onClick={handleClick}>Click me</Button>);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('can be disabled', () => {
        const handleClick = jest.fn();
        render(<Button disabled onClick={handleClick}>Disabled</Button>);

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();

        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });

    it('applies custom className', () => {
        render(<Button className="custom-class">Custom</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveClass('custom-class');
    });

    it('renders as child component when asChild is true', () => {
        render(
            <Button asChild>
                <a href="/test">Link Button</a>
            </Button>
        );

        const link = screen.getByRole('link', { name: /link button/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/test');
    });

    it('forwards ref correctly', () => {
        const ref = React.createRef<HTMLButtonElement>();
        render(<Button ref={ref}>Ref Button</Button>);

        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
});
