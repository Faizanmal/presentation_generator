import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

describe('Tabs Components', () => {
    it('renders tabs with default value', () => {
        render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>
        );

        expect(screen.getByText('Tab 1')).toBeInTheDocument();
        expect(screen.getByText('Tab 2')).toBeInTheDocument();
        expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    it('switches tabs when clicked', async () => {
        const user = userEvent.setup({ delay: null });

        render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>
        );

        const tab2Trigger = screen.getByText('Tab 2');
        await user.click(tab2Trigger);

        expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('handles controlled value', async () => {
        const handleValueChange = jest.fn();
        const user = userEvent.setup({ delay: null });

        render(
            <Tabs value="tab1" onValueChange={handleValueChange}>
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>
        );

        const tab2Trigger = screen.getByText('Tab 2');
        await user.click(tab2Trigger);

        expect(handleValueChange).toHaveBeenCalledWith('tab2');
    });

    it('can disable individual tabs', () => {
        render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>
        );

        const tab2Trigger = screen.getByText('Tab 2');
        expect(tab2Trigger).toBeDisabled();
    });

    it('applies custom className to TabsList', () => {
        render(
            <Tabs defaultValue="tab1">
                <TabsList className="custom-list" data-testid="tabs-list">
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
            </Tabs>
        );

        const tabsList = screen.getByTestId('tabs-list');
        expect(tabsList).toHaveClass('custom-list');
    });

    it('supports keyboard navigation', async () => {
        const user = userEvent.setup({ delay: null });

        render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                    <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
                <TabsContent value="tab3">Content 3</TabsContent>
            </Tabs>
        );

        const tab1 = screen.getByText('Tab 1');
        act(() => {
            tab1.focus();
        });

        await user.keyboard('{ArrowRight}');
        expect(screen.getByText('Tab 2')).toHaveFocus();
    });
});
