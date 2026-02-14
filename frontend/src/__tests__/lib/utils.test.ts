import { cn } from '@/lib/utils';

describe('utils', () => {
    describe('cn (classNames utility)', () => {
        it('merges class names correctly', () => {
            const result = cn('class1', 'class2');
            expect(result).toBe('class1 class2');
        });

        it('handles conditional classes', () => {
            const isActive = true;
            const isDisabled = false;

            const result = cn(
                'base-class',
                isActive && 'active-class',
                isDisabled && 'disabled-class'
            );

            expect(result).toContain('base-class');
            expect(result).toContain('active-class');
            expect(result).not.toContain('disabled-class');
        });

        it('handles undefined and null values', () => {
            const result = cn('class1', undefined, null, 'class2');
            expect(result).toBe('class1 class2');
        });

        it('handles empty strings', () => {
            const result = cn('class1', '', 'class2');
            expect(result).toBe('class1 class2');
        });

        it('merges Tailwind classes correctly (overwrites conflicting)', () => {
            // tailwind-merge should handle conflicting classes
            const result = cn('p-4', 'p-2');
            expect(result).toBe('p-2');
        });

        it('handles array of classes', () => {
            const result = cn(['class1', 'class2']);
            expect(result).toContain('class1');
            expect(result).toContain('class2');
        });

        it('handles object syntax', () => {
            const result = cn({
                'active-class': true,
                'disabled-class': false,
            });

            expect(result).toContain('active-class');
            expect(result).not.toContain('disabled-class');
        });

        it('combines multiple Tailwind utilities', () => {
            const result = cn(
                'flex items-center',
                'justify-between',
                'px-4 py-2',
                'bg-white dark:bg-gray-800'
            );

            expect(result).toContain('flex');
            expect(result).toContain('items-center');
            expect(result).toContain('justify-between');
            expect(result).toContain('px-4');
            expect(result).toContain('py-2');
        });

        it('returns empty string when no classes provided', () => {
            const result = cn();
            expect(result).toBe('');
        });
    });
});
