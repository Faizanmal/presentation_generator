import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';

describe('Input Component', () => {
    it('renders correctly', () => {
        render(<Input placeholder="Enter text" />);

        const input = screen.getByPlaceholderText('Enter text');
        expect(input).toBeInTheDocument();
    });

    it('accepts user input', async () => {
        const user = userEvent.setup({ delay: null });
        render(<Input placeholder="Type here" />);

        const input = screen.getByPlaceholderText('Type here');
        await user.type(input, 'Hello World');

        expect(input).toHaveValue('Hello World');
    });

    it('handles change events', async () => {
        const handleChange = jest.fn();
        const user = userEvent.setup({ delay: null });
        render(<Input onChange={handleChange} placeholder="Input" />);

        const input = screen.getByPlaceholderText('Input');
        await user.type(input, 'a');

        expect(handleChange).toHaveBeenCalled();
    });

    it('can be disabled', () => {
        render(<Input disabled placeholder="Disabled input" />);

        const input = screen.getByPlaceholderText('Disabled input');
        expect(input).toBeDisabled();
    });

    it('supports different types', () => {
        const { rerender } = render(<Input type="text" data-testid="input" />);
        expect(screen.getByTestId('input')).toHaveAttribute('type', 'text');

        rerender(<Input type="password" data-testid="input" />);
        expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');

        rerender(<Input type="email" data-testid="input" />);
        expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');

        rerender(<Input type="number" data-testid="input" />);
        expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
    });

    it('applies custom className', () => {
        render(<Input className="custom-input" data-testid="input" />);

        const input = screen.getByTestId('input');
        expect(input).toHaveClass('custom-input');
    });

    it('forwards ref correctly', () => {
        const ref = React.createRef<HTMLInputElement>();
        render(<Input ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('supports required attribute', () => {
        render(<Input required data-testid="input" />);

        const input = screen.getByTestId('input');
        expect(input).toBeRequired();
    });

    it('supports readOnly attribute', () => {
        render(<Input readOnly value="Read only" data-testid="input" />);

        const input = screen.getByTestId('input');
        expect(input).toHaveAttribute('readonly');
    });

    it('supports min and max for number inputs', () => {
        render(<Input type="number" min={0} max={100} data-testid="input" />);

        const input = screen.getByTestId('input');
        expect(input).toHaveAttribute('min', '0');
        expect(input).toHaveAttribute('max', '100');
    });

    it('handles focus and blur events', async () => {
        const handleFocus = jest.fn();
        const handleBlur = jest.fn();

        render(
            <Input
                onFocus={handleFocus}
                onBlur={handleBlur}
                data-testid="input"
            />
        );

        const input = screen.getByTestId('input');

        fireEvent.focus(input);
        expect(handleFocus).toHaveBeenCalledTimes(1);

        fireEvent.blur(input);
        expect(handleBlur).toHaveBeenCalledTimes(1);
    });
});
