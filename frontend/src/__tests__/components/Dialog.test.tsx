import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';

describe('Dialog Components', () => {
    it('renders trigger button', () => {
        render(
            <Dialog>
                <DialogTrigger>Open Dialog</DialogTrigger>
                <DialogContent>
                    <DialogTitle>Test Dialog</DialogTitle>
                    <DialogDescription>Description</DialogDescription>
                </DialogContent>
            </Dialog>
        );

        expect(screen.getByText('Open Dialog')).toBeInTheDocument();
    });

    it('opens dialog when trigger is clicked', async () => {
        const user = userEvent.setup({ delay: null });

        render(
            <Dialog>
                <DialogTrigger>Open Dialog</DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Test Dialog</DialogTitle>
                        <DialogDescription>This is a description</DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );

        const trigger = screen.getByText('Open Dialog');
        await user.click(trigger);

        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    });

    it('renders complete dialog structure', async () => {
        const user = userEvent.setup({ delay: null });

        render(
            <Dialog>
                <DialogTrigger>Open</DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dialog Title</DialogTitle>
                        <DialogDescription>This is a description</DialogDescription>
                    </DialogHeader>
                    <div>Main content</div>
                    <DialogFooter>
                        <DialogClose>Cancel</DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );

        await user.click(screen.getByText('Open'));

        expect(screen.getByText('Dialog Title')).toBeInTheDocument();
        expect(screen.getByText('This is a description')).toBeInTheDocument();
        expect(screen.getByText('Main content')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('can be controlled externally', () => {
        const TestComponent = () => {
            const [open, setOpen] = React.useState(true);

            return (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent>
                        <DialogTitle>Controlled Dialog</DialogTitle>
                        <DialogDescription>Description here</DialogDescription>
                    </DialogContent>
                </Dialog>
            );
        };

        render(<TestComponent />);

        expect(screen.getByText('Controlled Dialog')).toBeInTheDocument();
    });

    it('calls onOpenChange when closing', async () => {
        const handleOpenChange = jest.fn();
        const user = userEvent.setup({ delay: null });

        render(
            <Dialog open onOpenChange={handleOpenChange}>
                <DialogContent>
                    <DialogTitle>Test</DialogTitle>
                    <DialogDescription>Description</DialogDescription>
                    <DialogClose data-testid="close-btn">Cancel</DialogClose>
                </DialogContent>
            </Dialog>
        );

        const closeButton = screen.getByTestId('close-btn');
        await user.click(closeButton);

        expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
});
