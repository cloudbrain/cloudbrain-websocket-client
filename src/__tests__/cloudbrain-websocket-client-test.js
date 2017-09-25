import CloudbrainWebsocketClient from '../cloudbrain-websocket-client';

describe('CloudbrainWebsocketClient', () => {

  let client = {};
  let MockSockJS = () => {
    return {
      onopen: function () {},
      onmessage: function () {},
      onclose: function () {},
      open: function () {},
      close: function () {},
      send: function () {}
    };
  };
  let host = 'http://some.url';

  beforeEach(() => {
    client = new CloudbrainWebsocketClient({ host: host });
  });

  describe('constructor', () => {
    it('throws an error when missing parameters', () => {
      expect(() => { new CloudbrainWebsocketClient({}) }).toThrowError('SockJS' +
        ' connection URL not specified');
    });
  });

  describe('.connect', () => {
    let disconnectSpy = {};
    let openCallback = jasmine.createSpy('openCallback');
    let closeCallback = jasmine.createSpy('closeCallback');

    beforeEach(() => {
      disconnectSpy = spyOn(client, 'disconnect');
      client.connect(openCallback, closeCallback);
    });

    it('disconnects from an existing connection', () => {
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('creates a new connection', () => {
      expect(client.conn.constructor.name).toBe('SockJS');
    });

    describe('conn.onopen', () => {
      it('calls a callback when connection opens', () => {
        client.conn.onopen();
        expect(openCallback).toHaveBeenCalled();
      });
    });

    describe('conn.onclose', () => {
      it('calls a callback when connection closes', () => {
        client.conn.onclose();
        expect(closeCallback).toHaveBeenCalled();
      });
    });

    describe('conn.onmessage', () => {
      let messageCallback = jasmine.createSpy('messageCallback');
      let data = JSON.stringify({ device_name:  'openbci', metric: 'eeg' });
      let message = { data: data };

      beforeEach(() => {
        client.subscriptions = { openbci: { eeg: [messageCallback] } };
      });

      it('calls a callback when a message is received', () => {
        client._onmessage(message);
        expect(messageCallback).toHaveBeenCalled();
      });
    });
  });

  describe('.disconnect', () => {
    let closeConnSpy = {};

    beforeEach(() => {
      client.conn = MockSockJS();
      closeConnSpy = spyOn(client.conn, 'close');
      client.disconnect();
    });

    it('closes the connection', () => {
      expect(closeConnSpy).toHaveBeenCalled();
    });

    it('removed the connections', () => {
      expect(client.conn).toBe(null);
    });
  });

  describe('.subscribe', () => {
    let sendMessageSpy = {};
    let callback = () => {};
    let metric = 'eeg';
    let params = { deviceName: 'openbci' };

    describe('with device parameters', () => {
      beforeEach(() => {
        client.connect();
        sendMessageSpy = spyOn(client.conn, 'send');
        client.subscribe(metric, params, callback);
      });

      it('stores the callback', () => {
        expect(client.subscriptions).toEqual({ openbci: { eeg: [callback] } });
      });

      it('sends configuration message', () => {
        expect(sendMessageSpy).toHaveBeenCalled();
      });
    });

    describe('without device parameters', () => {
      beforeEach(() => {
        client = new CloudbrainWebsocketClient({ host: host,
                                           deviceName: params.deviceName });
        client.connect();
        sendMessageSpy = spyOn(client.conn, 'send');
        client.subscribe(metric, callback);
      });

      it('stores the callback', () => {
        expect(client.subscriptions).toEqual({ openbci: { eeg: [callback] } });
      });

      it('sends configuration message', () => {
        expect(sendMessageSpy).toHaveBeenCalled();
      });
    });

    describe('when no device parameters are available', () => {
      beforeEach(() => {
        client.connect();
        sendMessageSpy = spyOn(client.conn, 'send');
      });

      it('throws an error', () => {
        expect(() => { client.subscribe(metric, callback) }).toThrowError('Missing device parameters');
      });

      it('does not send a configuration message', () => {
        expect(sendMessageSpy).not.toHaveBeenCalled();
      });

    });
  });

  describe('.unsubscribe', () => {
    let sendMessageSpy = {};
    let callback = () => {};
    let metric = 'eeg';
    let params = { deviceName: 'openbci' };

    describe('with device parameters', () => {
      beforeEach(() => {
        client.connect();
        sendMessageSpy = spyOn(client.conn, 'send');
        client.subscribe(metric, params, callback);
        client.unsubscribe(metric, params, callback);
      });

      it('removes the callback', () => {
        expect(client.subscriptions).toEqual({ openbci: { eeg: [] } });
      });

      it('sends configuration message', () => {
        expect(sendMessageSpy).toHaveBeenCalled();
      });
    });

    describe('without device parameters', () => {
      beforeEach(() => {
        client = new CloudbrainWebsocketClient({ host: host,
                                           deviceName: params.deviceName });
        client.connect();
        sendMessageSpy = spyOn(client.conn, 'send');
        client.subscribe(metric, params, callback);
        client.unsubscribe(metric, callback);

      });

      it('stores the callback', () => {
        expect(client.subscriptions).toEqual({ openbci: { eeg: [] } });
      });

      it('sends configuration message', () => {
        expect(sendMessageSpy).toHaveBeenCalled();
      });
    });
  });

  describe('._createNestedObject', () => {
    it('returns a nested object', () => {
      let obj = {};
      const keys = ['one', 'two', 'three'];
      const expectedObj = { one: { two: { three: {} } } };
      client._createNestedObject(obj, keys)
      expect(obj).toEqual(expectedObj);
    });
  });
});
