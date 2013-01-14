/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var path = require('path'),
	request = require('request'),
	crypto = require('crypto'),
	uuid = require('node-uuid'),
	async = require('async'),
	wrench = require('wrench'),
	auth = require('./auth'),
	fs = require('fs'),
	getOSInfo = require('./environ').getOSInfo,
	afs = require('./fs'),
	mix = require('./util').mix,
	timestamp = require('./time').timestamp,
	interfaces = require('./net').interfaces,
	urlEncode = require('./net').urlEncode,
	events = [],
	url = 'https://api.appcelerator.net/p/v1/app-track',
	sessionTimeout = 60 * 60 * 1000; // 1 hour

exports.addEvent = function (name, data, type) {
	// adds to list of events to submit
	events.push({
		id: uuid.v4(),
		type: type || 'app.feature',
		name: name,
		ts: timestamp(),
		data: data
	});
};

exports.send = function (args) {
	var child = require('child_process').fork(module.filename);
	args.events = events;
	child.send(args);
};

process.on('message', function(m) {
	if (!m || !['appId', 'appName', 'appGuid', 'directory', 'version'].every(function (p) { return m.hasOwnProperty(p); })) {
		return;
	}
	
	async.parallel({
		mid: function (cb) {
			auth.getMID(function(mid) {
				cb(null, mid);
			});
		},
		
		osinfo: function (cb) {
			getOSInfo(function (info) {
				cb(null, info);
			});
		}
	}, function (err, results) {
		var directory = afs.resolvePath(m.directory),
			sessionFile = path.join(directory, 'analytics_session.json'),
			logFile = path.join(directory, 'analytics.json'),
			payload = [],
			payloadRetry = [],
			restoredPreviousSession = false,
			now = (new Date).getTime(),
			mid = results.mid,
			sid,
			sessionExpiration;
		
		function add(type, event, id, ts, data) {
			payload.push(mix({
				event: event,
				type: type,
				sid: sid,
				guid: m.appGuid,
				mid: mid,
				creator_user_id: m.uid,
				app_id: m.appId,
				app_name: m.appName,
				app_version: m.version,
				version: '1.1.0',
				tz: (new Date()).getTimezoneOffset(),
				ver: '2',
				un: m.email,
				data: JSON.stringify(data),
				id: id || uuid.v4(),
			}, results.osinfo));
		}
		
		afs.exists(directory) || wrench.mkdirSyncRecursive(directory);
		
		// Do we have a valid session
		if (afs.exists(sessionFile)) {
			try {
				var analyticsSession = JSON.parse(fs.readFileSync(sessionFile));
				
				sid = analyticsSession.sid;
				sessionExpiration = analyticsSession.sessionExpiration;
				
				// If the expiration has expired, create a new one
				if (sid && sessionExpiration && sessionExpiration > now) {
					restoredPreviousSession = true;
				} else {
					// add the ti.end event
					add('ti.end', 'ti.end', null, null);
				}
			} catch (e) {} // file was malformed, treat as if a new session
		}
		
		// If the previous session was not restored, create a new one
		if (!restoredPreviousSession) {
			// need to generate a new session id
			fs.writeFileSync(sessionFile, JSON.stringify({
				mid: mid,
				sid: sid = uuid.v4(),
				sessionExpiration: sessionExpiration = now + sessionTimeout
			}));
			
			add('ti.start', 'ti.start', null, null, null);
		}
		
		// add the list of app.feature events
		m.events.forEach(function (evt) {
			add(evt.type, evt.name, evt.id, evt.ts, evt.data);
		});
		
		// append payload to disk
		if (afs.exists(logFile)) {
			try {
				payload = JSON.parse(fs.readFileSync(logFile)).concat(payload);
			} catch (e) {}
		}
		
		function save() {
			// save events that failed to send
			fs.writeFileSync(logFile, JSON.stringify(payloadRetry));
			
			// make sure we save the latest session expiration
			fs.writeFileSync(sessionFile, JSON.stringify({
				mid: mid,
				sid: sid,
				sessionExpiration: (new Date).getTime() + sessionTimeout
			}));
		}
		
		if (payload.length) {
			// record the events before posting just in case of a problem
			fs.writeFileSync(logFile, JSON.stringify(payload));

			// console.log(payload);
			
			async.series(payload.map(function (data) {
				return function (callback) {
					request({
						uri: url,
						method: 'POST',
						headers: {
							Cookie: auth.status().cookie
						},
						body: urlEncode(data)
					}, function (error, response, body) {
						// Return the index if it failed and it needs to be written to the logfile again
						if (error || response.statusCode != 204) {
							payloadRetry.push(data);
						}
						callback();
					});
				};
			}), save);
		} else {
			save();
		}
	});
});