import { renderHook, act } from '@testing-library/react';
import {
    useDebounce,
    useDebouncedCallback,
    useLocalStorage,
    useSessionStorage,
    useMediaQuery,
    useIsMobile,
    useWindowSize,
    useCopyToClipboard
} from '@/hooks/use-debounce';

// Mock timers
jest.useFakeTimers();

describe('useDebounce', () => {
    afterEach(() => {
        jest.clearAllTimers();
    });

    it('returns initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    it('debounces value changes', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 500),
            { initialProps: { value: 'initial' } }
        );

        expect(result.current).toBe('initial');

        // Update the value
        rerender({ value: 'updated' });

        // Value should still be initial before timeout
        expect(result.current).toBe('initial');

        // Fast-forward time
        act(() => {
            jest.advanceTimersByTime(500);
        });

        // Now it should be updated
        expect(result.current).toBe('updated');
    });

    it('cancels previous timeout on rapid changes', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 500),
            { initialProps: { value: 'initial' } }
        );

        rerender({ value: 'first' });
        act(() => {
            jest.advanceTimersByTime(200);
        });

        rerender({ value: 'second' });
        act(() => {
            jest.advanceTimersByTime(200);
        });

        rerender({ value: 'third' });
        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(result.current).toBe('third');
    });
});

describe('useDebouncedCallback', () => {
    afterEach(() => {
        jest.clearAllTimers();
    });

    it('debounces callback execution', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        act(() => {
            result.current('arg1');
        });

        expect(callback).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledWith('arg1');
    });

    it('cancels previous call on rapid invocations', () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        act(() => {
            result.current('first');
        });
        act(() => {
            jest.advanceTimersByTime(100);
        });
        act(() => {
            result.current('second');
        });
        act(() => {
            jest.advanceTimersByTime(100);
        });
        act(() => {
            result.current('third');
        });
        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('third');
    });
});

describe('useLocalStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
    });

    it('returns initial value when localStorage is empty', () => {
        const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));
        expect(result.current[0]).toBe('defaultValue');
    });

    it('returns stored value from localStorage', () => {
        (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify('storedValue'));

        const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));
        expect(result.current[0]).toBe('storedValue');
    });

    it('updates localStorage when value changes', () => {
        const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

        act(() => {
            result.current[1]('newValue');
        });

        expect(window.localStorage.setItem).toHaveBeenCalledWith(
            'testKey',
            JSON.stringify('newValue')
        );
    });

    it('handles function updates', () => {
        const { result } = renderHook(() => useLocalStorage('counter', 0));

        act(() => {
            result.current[1]((prev: number) => prev + 1);
        });

        expect(result.current[0]).toBe(1);
    });
});

describe('useSessionStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (window.sessionStorage.getItem as jest.Mock).mockReturnValue(null);
    });

    it('returns initial value when sessionStorage is empty', () => {
        const { result } = renderHook(() => useSessionStorage('testKey', 'defaultValue'));
        expect(result.current[0]).toBe('defaultValue');
    });

    it('updates sessionStorage when value changes', () => {
        const { result } = renderHook(() => useSessionStorage('testKey', 'initial'));

        act(() => {
            result.current[1]('newValue');
        });

        expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
            'testKey',
            JSON.stringify('newValue')
        );
    });
});

describe('useMediaQuery', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns false initially', () => {
        const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
        expect(result.current).toBe(false);
    });

    it('calls matchMedia with the query', () => {
        renderHook(() => useMediaQuery('(max-width: 768px)'));
        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 768px)');
    });
});

describe('useIsMobile', () => {
    it('uses the mobile media query', () => {
        renderHook(() => useIsMobile());
        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 768px)');
    });
});

describe('useWindowSize', () => {
    it('returns current window dimensions', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

        const { result } = renderHook(() => useWindowSize());

        expect(result.current.width).toBe(1024);
        expect(result.current.height).toBe(768);
    });
});

describe('useCopyToClipboard', () => {
    const mockWriteText = jest.fn();

    beforeEach(() => {
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
            },
        });
        mockWriteText.mockResolvedValue(undefined);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('returns copy function and copied state', () => {
        const { result } = renderHook(() => useCopyToClipboard());

        expect(typeof result.current[0]).toBe('function');
        expect(result.current[1]).toBe(false);
    });

    it('copies text to clipboard', async () => {
        const { result } = renderHook(() => useCopyToClipboard());

        await act(async () => {
            await result.current[0]('test text');
        });

        expect(mockWriteText).toHaveBeenCalledWith('test text');
        expect(result.current[1]).toBe(true);
    });

    it('resets copied state after 2 seconds', async () => {
        const { result } = renderHook(() => useCopyToClipboard());

        await act(async () => {
            await result.current[0]('test text');
        });

        expect(result.current[1]).toBe(true);

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(result.current[1]).toBe(false);
    });

    it('returns false when copy fails', async () => {
        mockWriteText.mockRejectedValue(new Error('Copy failed'));

        const { result } = renderHook(() => useCopyToClipboard());

        let success: boolean = false;
        await act(async () => {
            success = await result.current[0]('test text');
        });

        expect(success).toBe(false);
        expect(result.current[1]).toBe(false);
    });
});
