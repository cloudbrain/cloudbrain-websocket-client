import SockJS from 'sockjs-client';

class CloudbrainWebsocket {
  constructor(config) {
    this.host = config.host;
    this.deviceName = config.deviceName;
    this.deviceId = config.deviceId;
    this.token = config.token;
    this.conn = null;
    this.subscriptions = {};

    if (!config.host) { throw Error('SockJS connection URL not specified'); }
  }

  disconnect = () => {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
  };

  connect = (onOpenCallback, onCloseCallback) => {
    this.disconnect();

    this.conn = new SockJS(this.host);

    this.conn.onopen = () => {
      if (onOpenCallback) {
        onOpenCallback();
      }
    };

    this.conn.onmessage = this._onmessage;

    this.conn.onclose = () => {
      Object.keys(this.subscriptions).forEach((key) => {
        this.subscriptions[key].length = 0;
      });

      if (onCloseCallback) {
        onCloseCallback();
      }

      this.conn = null;
    };
  };

  subscribe = (metric, params, onMessageCb) => {
    if (Object.prototype.toString.call(params) === '[object Function]') {
      onMessageCb = params;
    }

    let deviceName = params.deviceName || this.deviceName;
    let deviceId = params.deviceId || this.deviceId;
    let downsamplingFactor = params.downsamplingFactor || 1;
    let token = params.token || this.token;

    if(!metric) { throw Error('Missing metric') }
    if(!deviceName || !deviceId) { throw Error('Missing device parameters') }

    const config = {
      type: 'subscription',
      deviceName: deviceName,
      deviceId: deviceId,
      metric: metric,
      token: token,
      downsamplingFactor: downsamplingFactor
    };

    this._createNestedObject(this.subscriptions, [config.deviceId, config.deviceName]);

    if (this.subscriptions[config.deviceId][config.deviceName][metric]) {
      this.subscriptions[config.deviceId][config.deviceName][metric].push(onMessageCb);
    } else {
      this.subscriptions[config.deviceId][config.deviceName][metric] = [];
      this.subscriptions[config.deviceId][config.deviceName][metric].push(onMessageCb);
    }

    this.conn.send(JSON.stringify(config));
  };

  unsubscribe = (metric, params, onMessageCb) => {
    if (Object.prototype.toString.call(params) === '[object Function]') {
      onMessageCb = params;
    }

    let deviceName = params.deviceName || this.deviceName;
    let deviceId = params.deviceId || this.deviceId;

    if(!metric) { throw Error('Missing metric') }
    if(!deviceName || !deviceId) { throw Error('Missing device parameters') }

    const config = {
      type: 'unsubscription',
      deviceName: deviceName,
      deviceId: deviceId,
      metric: metric
    };

    if (this.subscriptions[config.deviceId][config.deviceName][metric]) {
      this.subscriptions[config.deviceId][config.deviceName][metric].splice(
        this.subscriptions[config.deviceId][config.deviceName][metric].indexOf(onMessageCb), 1);
    }

    this.conn.send(JSON.stringify(config));
  };

  _onmessage = (e) => {
    let jsonContent = JSON.parse(e.data);
    let fromMetric = jsonContent.metric;
    let fromDeviceId = jsonContent.device_id;
    let fromDeviceName = jsonContent.device_name;

    this.subscriptions[fromDeviceId][fromDeviceName][fromMetric].forEach((cb) => cb(jsonContent));
  };

  _createNestedObject = function( base, names ) {
    for (var i = 0; i < names.length; i++ ) {
      base = base[ names[i] ] = base[ names[i] ] || {};
    }
  };
}

export default CloudbrainWebsocket;
