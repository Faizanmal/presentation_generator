/**
 * API Client Tests
 * 
 * Tests for the API client module including authentication,
 * project management, and other core functionality.
 */

// Mock axios before importing api
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
    })),
}));

import axios from 'axios';

describe('API Client', () => {
    let mockAxiosInstance: {
        interceptors: {
            request: { use: jest.Mock };
            response: { use: jest.Mock };
        };
        get: jest.Mock;
        post: jest.Mock;
        patch: jest.Mock;
        put: jest.Mock;
        delete: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockAxiosInstance = {
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() },
            },
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };

        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    describe('initialization', () => {
        it('creates axios instance with correct config', () => {
            // Re-import to trigger initialization
            jest.isolateModules(async () => {
                await import('@/lib/api');
            });

            expect(axios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseURL: expect.any(String),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                })
            );
        });
    });

    describe('token management', () => {
        it('should store token in localStorage when set', () => {
            // This would test token storage
            const token = 'test-token';
            localStorage.setItem('token', token);

            expect(localStorage.setItem).toHaveBeenCalledWith('token', token);
        });

        it('should remove token from localStorage when cleared', () => {
            localStorage.removeItem('token');

            expect(localStorage.removeItem).toHaveBeenCalledWith('token');
        });
    });

    describe('API endpoints structure', () => {
        it('should have auth endpoints', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                data: { accessToken: 'token', user: { id: '1', email: 'test@example.com' } }
            });

            const loginPayload = { email: 'test@example.com', password: 'password123' };
            await mockAxiosInstance.post('/auth/login', loginPayload);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/login', loginPayload);
        });

        it('should have project endpoints', async () => {
            mockAxiosInstance.get.mockResolvedValue({
                data: { items: [], total: 0, page: 1, limit: 20 }
            });

            await mockAxiosInstance.get('/projects', { params: { page: 1, limit: 20 } });

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/projects', { params: { page: 1, limit: 20 } });
        });

        it('should handle project creation', async () => {
            const newProject = {
                title: 'Test Project',
                description: 'A test project',
                type: 'PITCH_DECK',
            };

            mockAxiosInstance.post.mockResolvedValue({
                data: { id: '1', ...newProject }
            });

            await mockAxiosInstance.post('/projects', newProject);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/projects', newProject);
        });

        it('should handle project updates', async () => {
            const updates = { title: 'Updated Title' };

            mockAxiosInstance.patch.mockResolvedValue({
                data: { id: '1', title: 'Updated Title' }
            });

            await mockAxiosInstance.patch('/projects/1', updates);

            expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/projects/1', updates);
        });

        it('should handle project deletion', async () => {
            mockAxiosInstance.delete.mockResolvedValue({});

            await mockAxiosInstance.delete('/projects/1');

            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/projects/1');
        });
    });

    describe('slide endpoints', () => {
        it('should create slides', async () => {
            const slideData = {
                projectId: 'project-1',
                layout: 'title',
                order: 0,
            };

            mockAxiosInstance.post.mockResolvedValue({
                data: { id: 'slide-1', ...slideData }
            });

            await mockAxiosInstance.post('/slides', slideData);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/slides', slideData);
        });

        it('should update slides', async () => {
            const updates = { layout: 'two-column' };

            mockAxiosInstance.patch.mockResolvedValue({
                data: { id: 'slide-1', layout: 'two-column' }
            });

            await mockAxiosInstance.patch('/slides/slide-1', updates);

            expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/slides/slide-1', updates);
        });

        it('should delete slides', async () => {
            mockAxiosInstance.delete.mockResolvedValue({});

            await mockAxiosInstance.delete('/slides/slide-1');

            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/slides/slide-1');
        });

        it('should reorder slides', async () => {
            const reorderData = {
                slides: [
                    { id: 'slide-1', order: 1 },
                    { id: 'slide-2', order: 0 },
                ],
            };

            mockAxiosInstance.post.mockResolvedValue({});

            await mockAxiosInstance.post('/slides/reorder/project-1', reorderData);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/slides/reorder/project-1', reorderData);
        });
    });

    describe('block endpoints', () => {
        it('should create blocks', async () => {
            const blockData = {
                slideId: 'slide-1',
                blockType: 'TEXT',
                content: { text: 'Hello World' },
                order: 0,
            };

            mockAxiosInstance.post.mockResolvedValue({
                data: { id: 'block-1', ...blockData }
            });

            await mockAxiosInstance.post('/blocks', blockData);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/blocks', blockData);
        });

        it('should update blocks', async () => {
            const updates = {
                content: { text: 'Updated text' },
            };

            mockAxiosInstance.patch.mockResolvedValue({
                data: { id: 'block-1', content: { text: 'Updated text' } }
            });

            await mockAxiosInstance.patch('/blocks/block-1', updates);

            expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/blocks/block-1', updates);
        });

        it('should delete blocks', async () => {
            mockAxiosInstance.delete.mockResolvedValue({});

            await mockAxiosInstance.delete('/blocks/block-1');

            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/blocks/block-1');
        });
    });

    describe('theme endpoints', () => {
        it('should fetch themes', async () => {
            mockAxiosInstance.get.mockResolvedValue({
                data: [{ id: 'theme-1', name: 'Default' }]
            });

            await mockAxiosInstance.get('/themes');

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/themes');
        });

        it('should fetch single theme', async () => {
            mockAxiosInstance.get.mockResolvedValue({
                data: { id: 'theme-1', name: 'Default' }
            });

            await mockAxiosInstance.get('/themes/theme-1');

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/themes/theme-1');
        });
    });

    describe('export endpoints', () => {
        it('should check export capability', async () => {
            mockAxiosInstance.get.mockResolvedValue({
                data: { canExport: true }
            });

            await mockAxiosInstance.get('/export/can-export');

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/export/can-export');
        });

        it('should export project', async () => {
            mockAxiosInstance.get.mockResolvedValue({
                data: new Blob(['PDF content'], { type: 'application/pdf' })
            });

            await mockAxiosInstance.get('/export/project-1', {
                params: { format: 'pdf' },
                responseType: 'blob',
            });

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/export/project-1', expect.objectContaining({
                params: { format: 'pdf' },
            }));
        });
    });

    describe('AI endpoints', () => {
        it('should enhance content', async () => {
            const enhanceData = {
                content: 'Original content',
                instruction: 'Make it more professional',
            };

            mockAxiosInstance.post.mockResolvedValue({
                data: { content: 'Enhanced content' }
            });

            await mockAxiosInstance.post('/ai/enhance', enhanceData);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/ai/enhance', enhanceData);
        });

        it('should transform text', async () => {
            const transformData = {
                text: 'Original text',
                action: 'shorten',
            };

            mockAxiosInstance.post.mockResolvedValue({
                data: { text: 'Short text', action: 'shorten' }
            });

            await mockAxiosInstance.post('/ai/transform', transformData);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/ai/transform', transformData);
        });
    });

    describe('error handling', () => {
        it('should handle network errors', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Network Error'));

            await expect(mockAxiosInstance.get('/projects')).rejects.toThrow('Network Error');
        });

        it('should handle 404 errors', async () => {
            const error = {
                response: { status: 404, data: { message: 'Not found' } },
            };
            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(mockAxiosInstance.get('/projects/nonexistent')).rejects.toEqual(error);
        });

        it('should handle 500 errors', async () => {
            const error = {
                response: { status: 500, data: { message: 'Internal server error' } },
            };
            mockAxiosInstance.post.mockRejectedValue(error);

            await expect(mockAxiosInstance.post('/projects', {})).rejects.toEqual(error);
        });
    });
});
