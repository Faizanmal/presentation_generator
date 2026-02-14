import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/ui/checkbox';

describe('Checkbox Component', () => {
    it('renders correctly', () => {
        render(<Checkbox aria-label="Agree to terms" />);

        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('toggles when clicked', async () => {
        const user = userEvent.setup({ delay: null });

        render(<Checkbox aria-label="Test checkbox" />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        await user.click(checkbox);
        expect(checkbox).toBeChecked();

        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it('handles controlled state', async () => {
        const handleCheckedChange = jest.fn();
        const user = userEvent.setup({ delay: null });

        render(
            <Checkbox
                checked={false}
                onCheckedChange={handleCheckedChange}
                aria-label="Controlled checkbox"
            />
        );

        const checkbox = screen.getByRole('checkbox');
        await user.click(checkbox);

        expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it('can be disabled', () => {
        render(<Checkbox disabled aria-label="Disabled checkbox" />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeDisabled();
    });

    it('can be checked by default', () => {
        render(<Checkbox defaultChecked aria-label="Default checked" />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('applies custom className', () => {
        render(<Checkbox className="custom-checkbox" aria-label="Custom" />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveClass('custom-checkbox');
    });

    it('works with labels', async () => {
        const user = userEvent.setup({ delay: null });

        render(
            <div className="flex items-center">
                <Checkbox id="terms" aria-labelledby="terms-label" />
                <label id="terms-label" htmlFor="terms">Accept terms</label>
            </div>
        );

        const label = screen.getByText('Accept terms');
        await user.click(label);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('forwards ref correctly', () => {
        const ref = React.createRef<HTMLButtonElement>();
        render(<Checkbox ref={ref} aria-label="Ref checkbox" />);

        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
});
