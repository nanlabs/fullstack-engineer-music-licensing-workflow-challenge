import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebsocketGateway } from './websocket.gateway';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
    };

    mockSocket = {
      id: 'test-client-id',
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebsocketGateway],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);
    gateway.server = mockServer as Server;

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log when a client connects', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleConnection(mockSocket as Socket);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Client connected: ${mockSocket.id}`,
      );
    });

    it('should log with correct client id', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      const newSocket = { ...mockSocket, id: 'different-client-id' };

      gateway.handleConnection(newSocket as Socket);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Client connected: different-client-id',
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should log when a client disconnects', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleDisconnect(mockSocket as Socket);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Client disconnected: ${mockSocket.id}`,
      );
    });

    it('should log with correct client id on disconnect', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      const newSocket = { ...mockSocket, id: 'disconnecting-client-id' };

      gateway.handleDisconnect(newSocket as Socket);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Client disconnected: disconnecting-client-id',
      );
    });
  });

  describe('emitLicenseStatusUpdate', () => {
    it('should emit license status update event', () => {
      const licenseId = 1;
      const statusId = 2;
      const statusName = 'Approved';
      const trackId = 10;

      gateway.emitLicenseStatusUpdate(licenseId, statusId, statusName, trackId);

      expect(mockServer.emit).toHaveBeenCalledWith('licenseStatusUpdate', {
        licenseId,
        statusId,
        statusName,
        trackId,
        timestamp: expect.any(Date),
      });
    });

    it('should emit license status update without trackId', () => {
      const licenseId = 1;
      const statusId = 2;
      const statusName = 'Pending';

      gateway.emitLicenseStatusUpdate(licenseId, statusId, statusName);

      expect(mockServer.emit).toHaveBeenCalledWith('licenseStatusUpdate', {
        licenseId,
        statusId,
        statusName,
        trackId: undefined,
        timestamp: expect.any(Date),
      });
    });

    it('should log the license status update', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      const licenseId = 1;
      const statusId = 2;
      const statusName = 'Approved';

      gateway.emitLicenseStatusUpdate(licenseId, statusId, statusName);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Emitting license status update: License ${licenseId} -> ${statusName}`,
      );
    });

    it('should include timestamp in the update payload', () => {
      const licenseId = 1;
      const statusId = 2;
      const statusName = 'Approved';
      const beforeDate = new Date();

      gateway.emitLicenseStatusUpdate(licenseId, statusId, statusName);

      const afterDate = new Date();
      const emitCall = (mockServer.emit as jest.Mock).mock.calls[0];
      const updatePayload = emitCall[1];
      const updateDate = new Date(updatePayload.timestamp);

      expect(updateDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(updateDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('should emit multiple license status updates', () => {
      gateway.emitLicenseStatusUpdate(1, 1, 'Pending');
      gateway.emitLicenseStatusUpdate(2, 2, 'Approved', 20);
      gateway.emitLicenseStatusUpdate(3, 3, 'Rejected', 30);

      expect(mockServer.emit).toHaveBeenCalledTimes(3);
      expect(mockServer.emit).toHaveBeenNthCalledWith(
        1,
        'licenseStatusUpdate',
        expect.objectContaining({
          licenseId: 1,
          statusId: 1,
          statusName: 'Pending',
        }),
      );
      expect(mockServer.emit).toHaveBeenNthCalledWith(
        2,
        'licenseStatusUpdate',
        expect.objectContaining({
          licenseId: 2,
          statusId: 2,
          statusName: 'Approved',
          trackId: 20,
        }),
      );
      expect(mockServer.emit).toHaveBeenNthCalledWith(
        3,
        'licenseStatusUpdate',
        expect.objectContaining({
          licenseId: 3,
          statusId: 3,
          statusName: 'Rejected',
          trackId: 30,
        }),
      );
    });

    it('should emit with correct event name', () => {
      gateway.emitLicenseStatusUpdate(1, 1, 'Pending');

      expect(mockServer.emit).toHaveBeenCalledWith(
        'licenseStatusUpdate',
        expect.any(Object),
      );
    });
  });

  describe('integration', () => {
    it('should handle connection and disconnection flow', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      const client1 = { ...mockSocket, id: 'client-1' };
      const client2 = { ...mockSocket, id: 'client-2' };

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleDisconnect(client1 as Socket);

      expect(loggerSpy).toHaveBeenCalledWith('Client connected: client-1');
      expect(loggerSpy).toHaveBeenCalledWith('Client connected: client-2');
      expect(loggerSpy).toHaveBeenCalledWith('Client disconnected: client-1');
    });

    it('should emit license update after client connects', () => {
      const client = { ...mockSocket, id: 'client-1' };

      gateway.handleConnection(client as Socket);
      gateway.emitLicenseStatusUpdate(1, 1, 'Pending');

      expect(mockServer.emit).toHaveBeenCalledWith(
        'licenseStatusUpdate',
        expect.any(Object),
      );
    });
  });
});
