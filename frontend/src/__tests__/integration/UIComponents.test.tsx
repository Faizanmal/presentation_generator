import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

describe('UI Components Integration', () => {
    describe('Form Interactions', () => {
        it('renders a complete form with button and input', async () => {
            const handleSubmit = jest.fn((e) => e.preventDefault());
            const user = userEvent.setup({ delay: null });

            render(
                <form onSubmit={handleSubmit}>
                    <Input
                        placeholder="Enter your name"
                        name="name"
                        data-testid="name-input"
                    />
                    <Button type="submit">Submit</Button>
                </form>
            );

            const input = screen.getByTestId('name-input');
            const button = screen.getByRole('button', { name: /submit/i });

            await user.type(input, 'John Doe');
            expect(input).toHaveValue('John Doe');

            await user.click(button);
            expect(handleSubmit).toHaveBeenCalled();
        });

        it('disables submit button based on input validation', async () => {
            const user = userEvent.setup({ delay: null });
            const TestForm = () => {
                const [value, setValue] = React.useState('');

                return (
                    <form>
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter text"
                            data-testid="input"
                        />
                        <Button disabled={value.length < 3} type="submit">
                            Submit
                        </Button>
                    </form>
                );
            };

            render(<TestForm />);

            const input = screen.getByTestId('input');
            const button = screen.getByRole('button');

            expect(button).toBeDisabled();

            await user.type(input, 'ab');
            expect(button).toBeDisabled();

            await user.type(input, 'c');
            expect(button).not.toBeDisabled();
        });
    });

    describe('Card with Content', () => {
        it('renders a card with multiple components', () => {
            render(
                <Card data-testid="project-card">
                    <CardHeader>
                        <CardTitle>Project Title</CardTitle>
                        <Badge variant="secondary">In Progress</Badge>
                    </CardHeader>
                    <CardContent>
                        <p>Project description goes here</p>
                        <Button size="sm">View Details</Button>
                    </CardContent>
                </Card>
            );

            expect(screen.getByTestId('project-card')).toBeInTheDocument();
            expect(screen.getByText('Project Title')).toBeInTheDocument();
            expect(screen.getByText('In Progress')).toBeInTheDocument();
            expect(screen.getByText('Project description goes here')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
        });
    });

    describe('Dynamic List Rendering', () => {
        it('renders a list of cards dynamically', () => {
            const items = [
                { id: '1', title: 'Item 1', status: 'active' },
                { id: '2', title: 'Item 2', status: 'inactive' },
                { id: '3', title: 'Item 3', status: 'active' },
            ];

            render(
                <div data-testid="item-list">
                    {items.map((item) => (
                        <Card key={item.id} data-testid={`item-${item.id}`}>
                            <CardHeader>
                                <CardTitle>{item.title}</CardTitle>
                                <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                                    {item.status}
                                </Badge>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            );

            expect(screen.getByTestId('item-list')).toBeInTheDocument();
            expect(screen.getByTestId('item-1')).toBeInTheDocument();
            expect(screen.getByTestId('item-2')).toBeInTheDocument();
            expect(screen.getByTestId('item-3')).toBeInTheDocument();
            expect(screen.getAllByText(/^active$/i)).toHaveLength(2);
        });
    });

    describe('Button Variants in Context', () => {
        it('renders multiple button variants correctly', async () => {
            const handlePrimary = jest.fn();
            const handleSecondary = jest.fn();
            const handleDestructive = jest.fn();
            const user = userEvent.setup({ delay: null });

            render(
                <div>
                    <Button variant="default" onClick={handlePrimary}>
                        Primary Action
                    </Button>
                    <Button variant="secondary" onClick={handleSecondary}>
                        Secondary Action
                    </Button>
                    <Button variant="destructive" onClick={handleDestructive}>
                        Delete
                    </Button>
                </div>
            );

            await user.click(screen.getByText('Primary Action'));
            expect(handlePrimary).toHaveBeenCalled();

            await user.click(screen.getByText('Secondary Action'));
            expect(handleSecondary).toHaveBeenCalled();

            await user.click(screen.getByText('Delete'));
            expect(handleDestructive).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('maintains proper focus order', async () => {
            const user = userEvent.setup({ delay: null });

            render(
                <form>
                    <Input data-testid="first-input" placeholder="First" />
                    <Input data-testid="second-input" placeholder="Second" />
                    <Button>Submit</Button>
                </form>
            );

            const firstInput = screen.getByTestId('first-input');
            const secondInput = screen.getByTestId('second-input');
            const button = screen.getByRole('button');

            await user.tab();
            expect(firstInput).toHaveFocus();

            await user.tab();
            expect(secondInput).toHaveFocus();

            await user.tab();
            expect(button).toHaveFocus();
        });

        it('supports keyboard interaction', async () => {
            const handleClick = jest.fn();
            const user = userEvent.setup({ delay: null });

            render(<Button onClick={handleClick}>Press Enter</Button>);

            const button = screen.getByRole('button');
            button.focus();

            await user.keyboard('{Enter}');
            expect(handleClick).toHaveBeenCalled();
        });
    });
});
