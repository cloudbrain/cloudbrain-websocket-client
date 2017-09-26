import SockJS from 'sockjs-client';
import React from 'react';


class CloudbrainWebsocketClient {
  constructor(config) {
    this.host = config.host;
    this.deviceName = config.deviceName;
    this.token = config.token;
    this.conn = null;
    this.subscriptions = {};

    if (!config.host) {
      throw Error('SockJS connection URL not specified');
    }
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
    let downsamplingFactor = params.downsamplingFactor || 1;
    let token = params.token || this.token;

    if (!metric) {
      throw Error('Missing metric')
    }
    if (!deviceName) {
      throw Error('Missing device parameters')
    }

    const config = {
      type: 'subscription',
      deviceName: deviceName,
      metric: metric,
      token: token,
      downsamplingFactor: downsamplingFactor
    };

    this._createNestedObject(this.subscriptions, [config.deviceName]);

    if (this.subscriptions[config.deviceName][metric]) {
      this.subscriptions[config.deviceName][metric].push(onMessageCb);
    } else {
      this.subscriptions[config.deviceName][metric] = [];
      this.subscriptions[config.deviceName][metric].push(onMessageCb);
    }

    this.conn.send(JSON.stringify(config));
  };

  unsubscribe = (metric, params, onMessageCb) => {
    if (Object.prototype.toString.call(params) === '[object Function]') {
      onMessageCb = params;
    }

    let deviceName = params.deviceName || this.deviceName;

    if (!metric) {
      throw Error('Missing metric')
    }
    if (!deviceName) {
      throw Error('Missing device parameters')
    }

    const config = {
      type: 'unsubscription',
      deviceName: deviceName,
      metric: metric
    };

    if (this.subscriptions[config.deviceName][metric]) {
      this.subscriptions[config.deviceName][metric].splice(
        this.subscriptions[config.deviceName][metric].indexOf(onMessageCb), 1);
    }

    this.conn.send(JSON.stringify(config));
  };

  _onmessage = (e) => {
    let jsonContent = JSON.parse(e.data);
    let fromMetric = jsonContent.metric;
    let fromDeviceName = jsonContent.device_name;

    this.subscriptions[fromDeviceName][fromMetric].forEach((cb) => cb(jsonContent));
  };

  _createNestedObject = function (base, names) {
    for (var i = 0; i < names.length; i++) {
      base = base[names[i]] = base[names[i]] || {};
    }
  };
}


function withStream(baseConfig) {
  let instance = null;

  return (BaseComponent) => class RealtimeComponent extends React.Component {
    constructor() {
      super();

      const config = Object.assign({}, baseConfig, {token: null});

      if (!instance) {
        this.state = {
          stream: new CloudbrainWebsocketClient(config)
        };

        this._connect(this._onOpen, this._onClose);

        this.pendingSubscriptions = [];

        instance = this;
      }

      return instance;
    }

    _connect = (onOpen, onClose) => {
      if (this.state.stream.conn === null) {
        this.state.stream.connect(onOpen, onClose);
      }
    };

    _onOpen = () => {
      console.log('Realtime Connection Open');
      this._subscribePending();
    };

    _onClose = () => {
      console.log('Realtime Connection Closed');
    };

    _subscribePending = () => {
      let sub = {};
      while (this.pendingSubscriptions.length > 0) {
        sub = this.pendingSubscriptions.pop();
        this.subscribe(sub.metric, sub.params, sub.cb);
      }
    };

    subscribe = (metric, params, cb) => {
      if (!this.state.stream.conn || this.state.stream.conn.readyState !== 1) {
        this.pendingSubscriptions.push({
          metric: metric,
          params: params,
          cb: cb
        });
      } else {
        this.state.stream.subscribe(metric, params, cb);
      }
    };

    unsubscribe = (metric, params) => {
      this.state.stream.unsubscribe(metric, params);
    };

    render() {
      return (
        <BaseComponent
          {...this.props}
          stream={{
            subscribe: this.subscribe,
            unsubscribe: this.unsubscribe
          }}
        />);
    }
  };
}

export {
  CloudbrainWebsocketClient,
  withStream
};
