import React from 'react';
import { render, screen } from '@testing-library/react';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';

describe('Select Components', () => {
    it('renders select trigger', () => {
        render(
            <Select>
                <SelectTrigger data-testid="trigger">
                    <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId('trigger')).toBeInTheDocument();
        expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('renders with role combobox', () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('displays selected value', () => {
        render(
            <Select defaultValue="option2">
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('can be disabled', () => {
        render(
            <Select disabled>
                <SelectTrigger data-testid="trigger">
                    <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        const trigger = screen.getByTestId('trigger');
        expect(trigger).toBeDisabled();
    });

    it('shows placeholder when no value selected', () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Choose an option..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="a">A</SelectItem>
                    <SelectItem value="b">B</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByText('Choose an option...')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(
            <Select>
                <SelectTrigger className="custom-select" data-testid="trigger">
                    <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId('trigger')).toHaveClass('custom-select');
    });
});
