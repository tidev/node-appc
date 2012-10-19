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
	needsEnroll = false,
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
	child.send(mix(args, { doEnroll: needsEnroll }));
	needsEnroll = false;
};

exports.enroll = function() {
	needsEnroll = true;
};

process.on('message', function(m) {
	if (!m || !['appId', 'appName', 'appGuid', 'directory', 'version', 'doEnroll'].every(function (p) { return m.hasOwnProperty(p); })) {
		return;
	}
	
	var appId = m.appId,
		appName = m.appName,
		appGuid = m.appGuid,
		directory = afs.resolvePath(m.directory),
		sessionFile = path.join(directory, 'analytics_session.json'),
		logFile = path.join(directory, 'analytics.json'),
		version = m.version,
		deployType = m.deployType,
		events = m.events,
		payload = [],
		seqId = 0,
		sid,
		mid,
		sessionExpiration,
		doEnroll = m.doEnroll,
		OSInfo,
		requests = [];

	function add(type, event, id, ts, data) {
		payload.push(mix({
			event: event,
			type: type,
			sid: sid,
			guid: appGuid,
			mid: mid,
			creator_user_id: m.uid,
			app_name: appName,
			app_version: version,
			// mac_addr: ,
			version: '1.1.0',
			tz: (new Date()).getTimezoneOffset(),
			ver: '2',
			un: m.email,
			// ip: ,
			data: JSON.stringify(data),
			id: id || uuid.v4(),
		}, OSInfo));
	}

	async.series([
		function (next) {
			auth.getMID(function(fetchedMID) {
				mid = fetchedMID;
				doEnroll = doEnroll || needsEnroll;
				next();
			});
		},

		function (next) {
			getOSInfo(function (info) {
				OSInfo = info;
				next();
			});
		},

		function (next) {

			var analyticsSession,
				restoredPreviousSession = false;

			directory = afs.resolvePath(directory);
			afs.exists(directory) || wrench.mkdirSyncRecursive(directory);

			deployType = deployType || 'production';

			// Do we have a valid session
			if (afs.exists(sessionFile)) {
				try {
					var analyticsSession = JSON.parse(fs.readFileSync(sessionFile));
					sid = analyticsSession.sid;
					seqId = analyticsSession.seqId;
					sessionExpiration = analyticsSession.sessionExpiration;

					// If the expiration has expired, create a new one
					if (sessionExpiration > Date.now()) {
						restoredPreviousSession = true;
					}
				} catch (e) {} // file was malformed, treat as if a new session
			}

			// If the previous session was not restored, create a new one
			if (!restoredPreviousSession) {
				sid = uuid.v4();
				sessionExpiration = Date.now() + sessionTimeout;
			}

			// Studio does not use an enroll event
			// // Enroll if need be
			// if (doEnroll) {
			// 	add('ti.enroll', 'ti.enroll', null, null, mix({
			// 		app_id: appId,
			// 		app_name: appName || 'node-appc',
			// 		deploytype: deployType,
			// 		platform: 'node.js'
			// 	}, OSInfo));
			// }
			next();
		},
		
		function (next) {
			var logExists = afs.exists(logFile),
				logMtime = logExists ? fs.statSync(logFile).mtime : 0;

			// when was the last event?
			if (!logExists || Date.now() - logMtime > sessionTimeout) {
				if (logExists) {
					// add the ti.end event
					add('ti.end', 'ti.end', null, null);
					// need to generate a new session id
					fs.writeFileSync(sessionFile, JSON.stringify({ sid: sid = uuid.v4(), seqId: seqId = 0, sessionExpiration: Date.now() }));
				}

				add('ti.start', 'ti.start', null, null, null);
			}
			next();
		}
	], function () {
		var tmp,
			i;

		// add the list of app.feature events
		events.forEach(function (evt) {
			add(evt.type, evt.name, evt.id, evt.ts, evt.data);
		});
		
		// append payload to disk
		if (afs.exists(logFile)) {
			try {
				tmp = JSON.parse(fs.readFileSync(logFile));
			} catch (e) {
				tmp = [];
			}
			payload = tmp.concat(payload);
		}

		if (payload.length) {
			// record the events before posting just in case of a problem
			fs.writeFileSync(logFile, JSON.stringify(payload, null, ''));

			// console.log(payload);
			
			var cookie = auth.status().cookie;
			
			// send the request
			for (i = 0; i < payload.length ; i++) {
				requests.push(createRequest(i, payload, cookie));
			}

			// Reset the tmp array
			tmp = [];

			async.parallel(requests, function (err, results) {

				for (i = 0; i < results.length; i++) {
					if (typeof results[i] == 'number') {
						tmp.push(payload[results[i]])
					}
				}

				// save events that failed to send
				fs.writeFileSync(logFile, JSON.stringify(tmp));

				// make sure we save the latest seqId
				fs.writeFileSync(sessionFile, JSON.stringify({ sid: sid, mid: mid, seqId: seqId }));

			});
		}
	});
});

function createRequest (index, payload, cookie) {
	return function(callback) {
		request({
			uri: url,
			method: 'POST',
			header: {
				Cookie: cookie
			},
			body: urlEncode(payload[index])
		}, function (error, response, body) {
			// Return the index if it failed and it needs to be written to the logfile again
			callback(error, (!error && response.statusCode == 204) ? undefined : i);
		});
	};
}
