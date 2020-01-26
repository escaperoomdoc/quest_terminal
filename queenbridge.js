// QueenBridge socket.io wrapper, purposes:
// 1. offline queues, socket.io does non provide
// 2. autoping, socket.io disconnects on timeout
// 3. simplification: register, error handling, queueing, etc... wrapper takes care of it
// 4. interface unification, socket.io sometimes changes it, wrapper takes care of it
// 5. if we will have to avoid of socket.io in the future, wrapper provides this easily

module.exports = function QueenBridge(host, options) {
	this.socket = null;
	this.queue = {
		send: [],
		publish: []
	}
	this.sendPending = 0;
	this.publishPending = 0;
	this.events = {};
	this.connected = false;
	this.msgId = 0;
	this.register = {
		id: null,
		autoping: 1000,
		keepOffline: 10000,
		override: false
	}
	const that = this;
	this.handleRegisterOptions = function(options) {
		if (!options) return;
		this.register.id = options.id;
		this.register.override = options.override;
		// if autoping is not defined => autoping = 1000 by default
		if (options.autoping === null || options.autoping >= 1000 && options.autoping <= 10000) {
			this.register.autoping = options.autoping;
		}
		if (options.keepOffline === null || options.keepOffline) {
			this.register.keepOffline = options.keepOffline;
		}
	}
	this.requestAbonents = function() {
		that.socket.emit('/api/abonents');
	}
	this.registerAbonent = function(options) {
		this.handleRegisterOptions(options);
		that.socket.emit('/api/register', this.register);
		this.requestAbonents();
	}
	this.on = function(event, callback) {
		this.events[event] = callback;
	}
	function connect() {
		that.socket = io.connect(host);
		that.socket.on('connect', function() {
			that.connected = true;
			if (that.events['connect']) that.events['connect']();
			that.registerAbonent(options);
		})
		that.socket.on('disconnect', function() {
			that.connected = false;
			if (that.events['disconnect']) that.events['disconnect']();
		})
		that.socket.on('/api/ping', function(data) {
			if (that.events['ping']) that.events['ping'](data);
		})
		that.socket.on('/api/abonents', function(data) {
			if (that.events['abonents']) that.events['abonents'](data);
		})
		that.socket.on('/api/register', function(data) {
			if (data.id) {
				that.register.id = data.id;
				if (that.events['register']) that.events['register'](data);
			}
			if (data.error) {
				data.type = 'register';
				if (that.events['error']) that.events['error'](data);
			}
		})
		that.socket.on('/api/receive', function(data) {
			if (that.events['receive']) {
				try {
					for (msg of data.msgs) {
						that.events['receive']({
							id: msg.dstId,
							payload: msg.payload
						});
					}
				}
				catch(error) {
					data = {type: 'receive', error: error};
					if (that.events['error']) that.events['error'](data);
				}
			}
			else
			if (that.events['receivebulk']) {
				that.events['receivebulk'](data);
			}
		})
		that.socket.on('/api/send', function(data) {
			if (that.sendPending > 0 && that.queue.send.length >= that.sendPending) {
				that.queue.send.splice(0, that.sendPending);
			}
		})
		that.socket.on('/api/publish', function(data) {
			if (that.publishPending > 0 && that.queue.publish.length >= that.publishPending) {
				that.queue.publish.splice(0, that.publishPending);
			}
		})
		that.socket.on('/api/topic', function() {
			if (that.events['topic']) that.events['topic']();
		})
		that.socket.on('/api/untopic', function() {
			if (that.events['untopic']) that.events['untopic']();
		})
		that.socket.on('/api/subscribe', function() {
			if (that.events['subscribe']) that.events['subscribe']();
		})
		that.socket.on('/api/unsubscribe', function() {
			if (that.events['unsubscribe']) that.events['unsubscribe']();
		})

	}
	this.transfer = function() {
		if (that.connected && that.queue.send.length>0 && that.sendPending===0) {
			that.socket.emit('/api/send', {msgs: that.queue.send});
			that.queue.send = []; // replace with the code below later...
			//that.sendPending = that.queue.send.length;
		}
		if (that.connected && that.queue.publish.length>0 && that.publishPending===0) {
			that.socket.emit('/api/publish', {msgs: that.queue.publish});
			that.queue.publish = []; // replace with the code below later...
			//that.publishPending = that.queue.publish.length;
		}
	}
	this.send = function(id, payload, options) {
		that.queue.send.push({
			dstId: id,
			msgId: ++that.msgId,
			payload: payload,
			options: options ? options : null
		});
		this.transfer();
	}
	this.sendbulk = function(data) {
		that.queue.send.concat(data.msgs);
		this.transfer();
	}
	this.topic = function(topic) {
		that.socket.emit('/api/topic', {topic: topic});
	}
	this.untopic = function(topic) {
		that.socket.emit('/api/untopic', {topic: topic});
	}
	this.subscribe = function(topic) {
		that.socket.emit('/api/subscribe', {topic: topic});
	}
	this.unsubscribe = function(topic) {
		that.socket.emit('/api/unsubscribe', {topic: topic});
	}
	this.publish = function(topic, payload, options) {
		that.queue.publish.push({
			topic: topic,
			msgId: ++that.msgId,
			payload: payload,
			options: options ? options : null
		});
		this.transfer();
	}
	this.publishbulk = function(data) {
		that.queue.publish.concat(data.msgs);
		this.transfer();
	}
	this.ping = function(id) {
		that.socket.emit('/api/ping', {id: id});
	}
	connect();
	setInterval(function() {
		that.transfer();
	}, 100);
	if (this.register.autoping) {
		setInterval(function() {
			that.socket.emit('/api/ping');
		}, this.register.autoping)
	}
}

