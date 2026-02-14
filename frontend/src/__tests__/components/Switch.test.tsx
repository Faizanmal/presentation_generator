import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '@/components/ui/switch';

describe('Switch Component', () => {
    it('renders correctly', () => {
        render(<Switch aria-label="Toggle switch" />);

        expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('toggles when clicked', async () => {
        const user = userEvent.setup({ delay: null });

        render(<Switch aria-label="Toggle switch" />);

        const switchElement = screen.getByRole('switch');
        expect(switchElement).toHaveAttribute('data-state', 'unchecked');

        await user.click(switchElement);
        expect(switchElement).toHaveAttribute('data-state', 'checked');

        await user.click(switchElement);
        expect(switchElement).toHaveAttribute('data-state', 'unchecked');
    });

    it('handles controlled state', async () => {
        const handleCheckedChange = jest.fn();
        const user = userEvent.setup({ delay: null });

        render(
            <Switch
                checked={false}
                onCheckedChange={handleCheckedChange}
                aria-label="Controlled switch"
            />
        );

        const switchElement = screen.getByRole('switch');
        await user.click(switchElement);

        expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it('can be disabled', () => {
        render(<Switch disabled aria-label="Disabled switch" />);

        const switchElement = screen.getByRole('switch');
        expect(switchElement).toBeDisabled();
    });

    it('shows checked state correctly', () => {
        render(<Switch defaultChecked aria-label="Checked switch" />);

        const switchElement = screen.getByRole('switch');
        expect(switchElement).toHaveAttribute('data-state', 'checked');
    });

    it('applies custom className', () => {
        render(<Switch className="custom-switch" aria-label="Custom switch" />);

        const switchElement = screen.getByRole('switch');
        expect(switchElement).toHaveClass('custom-switch');
    });

    it('forwards ref correctly', () => {
        const ref = React.createRef<HTMLButtonElement>();
        render(<Switch ref={ref} aria-label="Ref switch" />);

        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
});
