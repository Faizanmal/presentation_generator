import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API client
jest.mock('@/lib/api', () => ({
    api: {
        getProjects: jest.fn(),
        createProject: jest.fn(),
        updateProject: jest.fn(),
        deleteProject: jest.fn(),
        setToken: jest.fn(),
        clearToken: jest.fn(),
    },
}));

import { api } from '@/lib/api';

// Helper to create a wrapper with QueryClientProvider
const _createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
    Wrapper.displayName = 'QueryClientWrapper';
    return Wrapper;
};

describe('Data Fetching Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Project API', () => {
        it('fetches projects successfully', async () => {
            const mockProjects = {
                data: [
                    { id: '1', title: 'Project 1', description: 'Desc 1' },
                    { id: '2', title: 'Project 2', description: 'Desc 2' },
                ],
                meta: {
                    total: 2,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                },
            };

            (api.getProjects as jest.Mock).mockResolvedValue(mockProjects);

            const result = await api.getProjects(1, 20);

            expect(api.getProjects).toHaveBeenCalledWith(1, 20);
            expect(result.data).toHaveLength(2);
            expect(result.data[0].title).toBe('Project 1');
        });

        it('creates a project successfully', async () => {
            const newProject = {
                title: 'New Project',
                description: 'New Description',
                type: 'PITCH_DECK',
            };

            const createdProject = {
                id: '3',
                ...newProject,
                createdAt: new Date().toISOString(),
            };

            (api.createProject as jest.Mock).mockResolvedValue(createdProject);

            const result = await api.createProject(newProject);

            expect(api.createProject).toHaveBeenCalledWith(newProject);
            expect(result.id).toBe('3');
            expect(result.title).toBe('New Project');
        });

        it('updates a project successfully', async () => {
            const projectId = '1';
            const updates = { title: 'Updated Project' };

            const updatedProject = {
                id: projectId,
                title: 'Updated Project',
                description: 'Original Description',
            };

            (api.updateProject as jest.Mock).mockResolvedValue(updatedProject);

            const result = await api.updateProject(projectId, updates);

            expect(api.updateProject).toHaveBeenCalledWith(projectId, updates);
            expect(result.title).toBe('Updated Project');
        });

        it('deletes a project successfully', async () => {
            const projectId = '1';

            (api.deleteProject as jest.Mock).mockResolvedValue({ success: true });

            await api.deleteProject(projectId);

            expect(api.deleteProject).toHaveBeenCalledWith(projectId);
            expect(api.deleteProject).toHaveBeenCalledWith(projectId);
        });

        it('handles API errors gracefully', async () => {
            const error = new Error('Network error');
            (api.getProjects as jest.Mock).mockRejectedValue(error);

            await expect(api.getProjects()).rejects.toThrow('Network error');
        });
    });

    describe('Authentication', () => {
        it('sets token correctly', () => {
            api.setToken('test-token');
            expect(api.setToken).toHaveBeenCalledWith('test-token');
        });

        it('clears token correctly', () => {
            api.clearToken();
            expect(api.clearToken).toHaveBeenCalled();
        });
    });

    describe('Pagination', () => {
        it('handles pagination parameters', async () => {
            const page2Response = {
                data: [
                    { id: '21', title: 'Project 21' },
                    { id: '22', title: 'Project 22' },
                ],
                meta: {
                    total: 50,
                    page: 2,
                    limit: 20,
                    totalPages: 3,
                },
            };

            (api.getProjects as jest.Mock).mockResolvedValue(page2Response);

            const result = await api.getProjects(2, 20);

            expect(api.getProjects).toHaveBeenCalledWith(2, 20);
            expect(result.meta.page).toBe(2);
            expect(result.meta.total).toBe(50);
        });
    });
});
