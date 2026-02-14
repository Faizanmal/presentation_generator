"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook to debounce a value
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook to debounce a callback function
 * @param callback - The callback to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced callback
 */

export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number
): T {
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            const id = setTimeout(() => {
                callback(...args);
            }, delay);

            setTimeoutId(id);
        },
        [callback, delay, timeoutId]
    ) as T;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [timeoutId]);

    return debouncedCallback;
}

/**
 * Hook to throttle a callback function
 * @param callback - The callback to throttle
 * @param delay - Minimum delay between calls in milliseconds
 * @returns The throttled callback
 */

export function useThrottle<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number
): T {
    const [lastRun, setLastRun] = useState(0);

    const throttledCallback = useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();

            if (now - lastRun >= delay) {
                callback(...args);
                setLastRun(now);
            }
        },
        [callback, delay, lastRun]
    ) as T;

    return throttledCallback;
}

/**
 * Hook to detect clicks outside a ref
 * @param ref - React ref to the element
 * @param handler - Handler to call when clicked outside
 */
export function useOnClickOutside<T extends HTMLElement>(
    ref: React.RefObject<T>,
    handler: (event: MouseEvent | TouchEvent) => void
) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };

        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);

        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [ref, handler]);
}

/**
 * Hook to persist state in localStorage
 * @param key - localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns State and setter like useState
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    // Get from localStorage or use initial value
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // Save to localStorage when value changes
    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            try {
                const valueToStore =
                    value instanceof Function ? value(storedValue) : value;
                setStoredValue(valueToStore);
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
            } catch (error) {
                console.error(`Error setting localStorage key "${key}":`, error);
            }
        },
        [key, storedValue]
    );

    return [storedValue, setValue];
}

/**
 * Hook to sync state with sessionStorage
 * @param key - sessionStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns State and setter like useState
 */
export function useSessionStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading sessionStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            try {
                const valueToStore =
                    value instanceof Function ? value(storedValue) : value;
                setStoredValue(valueToStore);
                if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
                }
            } catch (error) {
                console.error(`Error setting sessionStorage key "${key}":`, error);
            }
        },
        [key, storedValue]
    );

    return [storedValue, setValue];
}

/**
 * Hook to detect if media query matches
 * @param query - Media query string
 * @returns Whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") { return; }

        const media = window.matchMedia(query);

        const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
        media.addEventListener("change", listener);

        // Set initial state only once
        if (!initializedRef.current) {
            setTimeout(() => {
                setMatches(media.matches);
                initializedRef.current = true;
            }, 0);
        }

        return () => media.removeEventListener("change", listener);
    }, [query]);

    return matches;
}

/**
 * Hook to detect mobile viewport
 */
export function useIsMobile(): boolean {
    return useMediaQuery("(max-width: 768px)");
}

/**
 * Hook to detect preferred color scheme
 */
export function usePrefersDarkMode(): boolean {
    return useMediaQuery("(prefers-color-scheme: dark)");
}

/**
 * Hook to track window size
 */
export function useWindowSize(): { width: number; height: number } {
    const [size, setSize] = useState({
        width: typeof window !== "undefined" ? window.innerWidth : 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
    });

    useEffect(() => {
        if (typeof window === "undefined") { return; }

        const handleResize = () => {
            setSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return size;
}

/**
 * Hook to track keyboard shortcuts
 */
export function useKeyboardShortcut(
    keys: string[], // e.g., ['ctrl', 'k'] or ['meta', 'shift', 's']
    callback: () => void,
    options: { preventDefault?: boolean } = {}
) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const pressedKeys = new Set<string>();

            if (event.ctrlKey) { pressedKeys.add("ctrl"); }
            if (event.metaKey) { pressedKeys.add("meta"); }
            if (event.shiftKey) { pressedKeys.add("shift"); }
            if (event.altKey) { pressedKeys.add("alt"); }
            pressedKeys.add(event.key.toLowerCase());

            const requiredKeys = new Set(keys.map((k) => k.toLowerCase()));

            if (
                pressedKeys.size === requiredKeys.size &&
                [...requiredKeys].every((k) => pressedKeys.has(k))
            ) {
                if (options.preventDefault) {
                    event.preventDefault();
                }
                callback();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [keys, callback, options.preventDefault]);
}

/**
 * Hook to copy text to clipboard
 */
export function useCopyToClipboard(): [
    (text: string) => Promise<boolean>,
    boolean
] {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return true;
        } catch {
            setCopied(false);
            return false;
        }
    }, []);

    return [copy, copied];
}
