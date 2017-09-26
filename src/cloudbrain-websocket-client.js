import SockJS from 'sockjs-client';
import React from 'react';


class CloudbrainWebsocketClient {
  constructor(config) {
    this.host = config.host;
    this.exchangeName = config.exchangeName;
    this.routingKey = config.routingKey;
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

  subscribe = (params, onMessageCb) => {
    if (Object.prototype.toString.call(params) === '[object Function]') {
      onMessageCb = params;
    }

    let exchangeName = params.exchangeName || this.exchangeName;
    let routingKey = params.routingKey || this.routingKey;
    let downsamplingFactor = params.downsamplingFactor || 1;
    let token = params.token || this.token;

    if (!exchangeName) {
      throw Error('Missing exchange name')
    }
    if (!routingKey) {
      throw Error('Missing routing key')
    }

    const config = {
      type: 'subscription',
      exchangeName: exchangeName,
      routingKey: routingKey,
      token: token,
      downsamplingFactor: downsamplingFactor
    };

    this._createNestedObject(this.subscriptions, [config.exchangeName]);

    if (this.subscriptions[config.exchangeName][routingKey]) {
      this.subscriptions[config.exchangeName][routingKey].push(onMessageCb);
    } else {
      this.subscriptions[config.exchangeName][routingKey] = [];
      this.subscriptions[config.exchangeName][routingKey].push(onMessageCb);
    }

    this.conn.send(JSON.stringify(config));
  };

  unsubscribe = (params, onMessageCb) => {
    if (Object.prototype.toString.call(params) === '[object Function]') {
      onMessageCb = params;
    }

    let exchangeName = params.exchangeName || this.exchangeName;
    let routingKey = params.routingKey || this.routingKey;

    if (!exchangeName) {
      throw Error('Missing exchange name')
    }
    if (!routingKey) {
      throw Error('Missing routing key')
    }

    const config = {
      type: 'unsubscription',
      exchangeName: exchangeName,
      routingKey: routingKey
    };

    if (this.subscriptions[config.exchangeName][routingKey]) {
      this.subscriptions[config.exchangeName][routingKey].splice(
        this.subscriptions[config.exchangeName][routingKey].indexOf(onMessageCb), 1);
    }

    this.conn.send(JSON.stringify(config));
  };

  _onmessage = (e) => {
    let jsonContent = JSON.parse(e.data);
    let fromExchangeName = jsonContent.exchangeName;
    let fromRoutingKey = jsonContent.routingKey;

    this.subscriptions[fromExchangeName][fromRoutingKey].forEach((cb) => cb(jsonContent));
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
        this.subscribe(sub.params, sub.cb);
      }
    };

    subscribe = (params, cb) => {
      if (!this.state.stream.conn || this.state.stream.conn.readyState !== 1) {
        this.pendingSubscriptions.push({
          params: params,
          cb: cb
        });
      } else {
        this.state.stream.subscribe(params, cb);
      }
    };

    unsubscribe = (params) => {
      this.state.stream.unsubscribe(params);
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
