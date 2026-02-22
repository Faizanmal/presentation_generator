import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';

// Mock API
const mockApi = {
    fetchData: jest.fn(),
    mutateData: jest.fn(),
};

// Create a wrapper for QueryClientProvider
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            },
        },
    });

    return function QueryClientWrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    };
};

// Custom hook that uses React Query
function useApiQuery<T>(key: string[], fetchFn: () => Promise<T>) {
    return useQuery({
        queryKey: key,
        queryFn: fetchFn,
    });
}

// Custom hook for mutations
function useApiMutation<TData, TVariables>(
    mutationFn: (vars: TVariables) => Promise<TData>
) {
    return useMutation({
        mutationFn,
    });
}

describe('useApi Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query Hook', () => {
        it('fetches data successfully', async () => {
            const mockData = { id: '1', name: 'Test' };
            mockApi.fetchData.mockResolvedValue(mockData);

            const { result } = renderHook(
                () => useApiQuery(['test'], mockApi.fetchData),
                { wrapper: createWrapper() }
            );

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockData);
            expect(mockApi.fetchData).toHaveBeenCalledTimes(1);
        });

        it('handles fetch errors', async () => {
            const error = new Error('Failed to fetch');
            mockApi.fetchData.mockRejectedValue(error);

            const { result } = renderHook(
                () => useApiQuery(['test-error'], mockApi.fetchData),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeDefined();
        });

        it('returns loading state while fetching', async () => {
            mockApi.fetchData.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100))
            );

            const { result } = renderHook(
                () => useApiQuery(['loading-test'], mockApi.fetchData),
                { wrapper: createWrapper() }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();
        });
    });

    describe('Mutation Hook', () => {
        it('mutates data successfully', async () => {
            const mockResponse = { id: '1', name: 'Updated' };
            mockApi.mutateData.mockResolvedValue(mockResponse);

            const { result } = renderHook(
                () => useApiMutation(mockApi.mutateData),
                { wrapper: createWrapper() }
            );

            expect(result.current.isPending).toBe(false);

            act(() => {
                result.current.mutate({ id: '1', name: 'Updated' });
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockResponse);
            expect(mockApi.mutateData).toHaveBeenCalledWith({ id: '1', name: 'Updated' }, expect.anything());
        });

        it('handles mutation errors', async () => {
            const error = new Error('Mutation failed');
            mockApi.mutateData.mockRejectedValue(error);

            const { result } = renderHook(
                () => useApiMutation(mockApi.mutateData),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.mutate({ id: '1' });
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeDefined();
        });

        it('shows pending state during mutation', async () => {
            let resolveMutation: (value: unknown) => void;
            mockApi.mutateData.mockImplementation(
                () => new Promise((resolve) => { resolveMutation = resolve; })
            );

            const { result } = renderHook(
                () => useApiMutation(mockApi.mutateData),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.mutate({ data: 'test' });
            });

            await waitFor(() => {
                expect(result.current.isPending).toBe(true);
            });

            act(() => {
                if (resolveMutation) { resolveMutation({ success: true }); }
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });

        it('resets state after successful mutation', async () => {
            mockApi.mutateData.mockResolvedValue({ success: true });

            const { result } = renderHook(
                () => useApiMutation(mockApi.mutateData),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.mutate({ data: 'first' });
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            act(() => {
                result.current.reset();
            });

            await waitFor(() => {
                expect(result.current.status).toBe('idle');
            });

            expect(result.current.isSuccess).toBe(false);
            expect(result.current.isError).toBe(false);
            expect(result.current.data).toBeUndefined();
        });
    });

    // ------------------------------------------------------------------
    // predictive analytics hook tests
    // ------------------------------------------------------------------
    describe('usePredictiveAnalytics hook', () => {
        it('returns query objects and handles loading/success', async () => {
            const { usePredictiveAnalytics } = await import('@/hooks/use-new-features');
            const apiModule = await import('@/lib/api');

            const insights = [{ id: '1', metric: 'views', predicted: 50, confidence: 80, trend: 'up', description: 'test' }];
            const recs = [{ id: 'r1', title: 'Tip', description: 'desc', impact: 'high', priority: 'low' }];
            const benches = [{ id: 'b1', metric: 'views', yourScore: 40, industryAvg: 50, topPerformer: 90 }];

            /* eslint-disable @typescript-eslint/no-explicit-any */
            jest.spyOn(apiModule.api.predictive, 'getInsights').mockResolvedValue(insights as any);
            jest.spyOn(apiModule.api.predictive, 'getRecommendations').mockResolvedValue(recs as any);
            jest.spyOn(apiModule.api.predictive, 'getBenchmarks').mockResolvedValue(benches as any);
            /* eslint-enable @typescript-eslint/no-explicit-any */

            const projectId = 'proj-123';
            const { result } = renderHook(() => usePredictiveAnalytics(projectId), { wrapper: createWrapper() });

            expect(result.current.insights.isLoading).toBe(true);
            expect(result.current.recommendations.isLoading).toBe(true);
            expect(result.current.benchmarks.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.insights.isSuccess).toBe(true);
                expect(result.current.recommendations.isSuccess).toBe(true);
                expect(result.current.benchmarks.isSuccess).toBe(true);
            });

            expect(result.current.insights.data).toEqual(insights);
            expect(result.current.recommendations.data).toEqual(recs);
            expect(result.current.benchmarks.data).toEqual(benches);
        });
    });
});
