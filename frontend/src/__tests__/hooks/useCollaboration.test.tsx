import { renderHook, act } from '@testing-library/react';
import { useCollaboration } from '@/hooks/use-collaboration';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

// Mock editor store
jest.mock('@/stores/editor-store', () => ({
  useEditorStore: () => ({
    updateBlock: jest.fn(),
    addSlide: jest.fn(),
    deleteSlide: jest.fn(),
    reorderSlides: jest.fn(),
  }),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('useCollaboration', () => {
  let mockSocket: {
    on: jest.Mock;
    emit: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to socket server with correct options', () => {
    renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('/collaboration'),
      expect.objectContaining({
        auth: { token: 'test-token' },
        transports: ['websocket', 'polling'],
      }),
    );
  });

  it('should not connect without projectId or token', () => {
    renderHook(() =>
      useCollaboration({
        projectId: '',
        token: '',
      }),
    );

    expect(io).not.toHaveBeenCalled();
  });

  it('should join project room on connect', () => {
    renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    // Find the connect handler
    const connectHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'connect',
    )?.[1];

    // Simulate connection
    if (connectHandler) {
      connectHandler();
    }

    expect(mockSocket.emit).toHaveBeenCalledWith('project:join', {
      projectId: 'project-1',
    });
  });

  it('should update collaborators list when received', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    // Find the collaborators:list handler
    const listHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'collaborators:list',
    )?.[1];

    const mockCollaborators = [
      { userId: 'user-1', userName: 'Alice', color: '#ff0000', socketId: 'socket-1' },
      { userId: 'user-2', userName: 'Bob', color: '#00ff00', socketId: 'socket-2' },
    ];

    // Simulate receiving collaborators list
    act(() => {
      if (listHandler) {
        listHandler(mockCollaborators);
      }
    });

    expect(result.current.collaborators).toHaveLength(2);
    expect(result.current.collaborators[0].userName).toBe('Alice');
  });

  it('should add collaborator when user joins', () => {
    const onUserJoined = jest.fn();
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
        onUserJoined,
      }),
    );

    // Find the user:joined handler
    const joinHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'user:joined',
    )?.[1];

    const newUser = {
      userId: 'user-3',
      userName: 'Charlie',
      color: '#0000ff',
      socketId: 'socket-3',
    };

    act(() => {
      if (joinHandler) {
        joinHandler(newUser);
      }
    });

    expect(result.current.collaborators).toContainEqual(
      expect.objectContaining({ userId: 'user-3' }),
    );
    expect(onUserJoined).toHaveBeenCalledWith(newUser);
  });

  it('should remove collaborator when user leaves', () => {
    const onUserLeft = jest.fn();
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
        onUserLeft,
      }),
    );

    // First add some collaborators
    const listHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'collaborators:list',
    )?.[1];

    act(() => {
      if (listHandler) {
        listHandler([
          { userId: 'user-1', userName: 'Alice', color: '#ff0000', socketId: 'socket-1' },
        ]);
      }
    });

    // Then have one leave
    const leaveHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'user:left',
    )?.[1];

    act(() => {
      if (leaveHandler) {
        leaveHandler({ userId: 'user-1', userName: 'Alice', socketId: 'socket-1' });
      }
    });

    expect(result.current.collaborators).toHaveLength(0);
    expect(onUserLeft).toHaveBeenCalled();
  });

  it('should update cursors when received', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    const cursorHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'cursor:update',
    )?.[1];

    const cursorData = {
      userId: 'user-1',
      userName: 'Alice',
      color: '#ff0000',
      x: 100,
      y: 200,
      slideIndex: 0,
    };

    act(() => {
      if (cursorHandler) {
        cursorHandler(cursorData);
      }
    });

    expect(result.current.cursors.size).toBe(1);
    expect(result.current.cursors.get('user-1')).toMatchObject({
      x: 100,
      y: 200,
      slideIndex: 0,
    });
  });

  it('should send cursor position', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    act(() => {
      result.current.sendCursorPosition({ x: 50, y: 75, slideIndex: 1 });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('cursor:move', {
      x: 50,
      y: 75,
      slideIndex: 1,
    });
  });

  it('should send block update', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    act(() => {
      result.current.sendBlockUpdate('slide-1', 'block-1', { text: 'Updated' });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('block:update', {
      projectId: 'project-1',
      slideId: 'slide-1',
      blockId: 'block-1',
      data: { text: 'Updated' },
    });
  });

  it('should send slide add', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    const newSlide = { id: 'slide-2', title: 'New Slide' };

    act(() => {
      result.current.sendSlideAdd(newSlide);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('slide:add', {
      projectId: 'project-1',
      slide: newSlide,
    });
  });

  it('should send slide delete', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    act(() => {
      result.current.sendSlideDelete('slide-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('slide:delete', {
      projectId: 'project-1',
      slideId: 'slide-1',
    });
  });

  it('should send slide reorder', () => {
    const { result } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    act(() => {
      result.current.sendSlideReorder(0, 2);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('slide:reorder', {
      projectId: 'project-1',
      fromIndex: 0,
      toIndex: 2,
    });
  });

  it('should disconnect and leave project on cleanup', () => {
    const { unmount } = renderHook(() =>
      useCollaboration({
        projectId: 'project-1',
        token: 'test-token',
      }),
    );

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('project:leave', {
      projectId: 'project-1',
    });
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
