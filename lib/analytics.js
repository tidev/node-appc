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
	auth = require('./auth')
	fs = require('fs'),
	getOSInfo = require('./environ').getOSInfo,
	afs = require('./fs'),
	mix = require('./util').mix,
	timestamp = require('./time').timestamp,
	interfaces = require('./net').interfaces,
	events = [],
	url = 'https://api.appcelerator.net/p/v2/mobile-track',
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
		ids = {},
		doEnroll = m.doEnroll;
	
	function add(type, event, id, ts, data) {
		ids[id] = 1;
		payload.push({
			id: id || uuid.v4(),
			mid: mid,
			rdu: null,
			type: type,
			aguid: appGuid,
			event: event,
			seq: seqId++,
			ver: '2',
			deploytype: deployType,
			sid: sid,
			ts: ts || timestamp(),
			data: data
		});
	}
	
	async.series([
		function (next) {
			auth.getMID(function(fetchedMID) {
				mid = fetchedMID;
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
					var analyticsSession = JSON.parse(fs.readFileSync(sessionFile)).analytics;
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

			// Enroll if need be
			if (doEnroll) {
				getOSInfo(function (info) {
					add('ti.enroll', 'ti.enroll', null, null, mix({
						app_id: appId,
						app_name: appName || 'node-appc',
						deploytype: deployType,
						platform: 'node.js'
					}, info));
					next();
				});
			} else {
				next();
			}
		},
		
		function (next) {
			var logExists = afs.exists(logFile),
				logMtime = logExists ? fs.statSync(logFile).mtime : 0;
			
			// when was the last event?
			if (!logExists || Date.now() - logMtime > sessionTimeout) {
				if (logExists) {
					// add the ti.end event
					add('ti.end', 'ti.end', null, logMtime);
					// need to generate a new session id
					fs.writeFileSync(sessionFile, JSON.stringify({ sid: sid = uuid.v4(), seqId: seqId = 0, sessionExpiration: Date.now() }));
				}
				
				getOSInfo(function (info) {
					add('ti.start', 'ti.start', null, null, mix({
						deploytype: deployType,
						platform: 'node.js',
						version: version,
						tz: (new Date).getTimezoneOffset()
					}, info));
					
					next();
				});
			} else {
				next();
			}
		}
	], function () {
		// add the list of app.feature events
		events.forEach(function (evt) {
			add(evt.type, evt.name, evt.id, evt.ts, evt.data);
		});
		
		// append payload to disk
		if (afs.exists(logFile)) {
			var tmp;
			try {
				tmp = JSON.parse(fs.readFileSync(logFile));
			} catch (e) {
				tmp = [];
			}
			payload = tmp.concat(payload);
		}
		
		if (payload.length) {
			// record the events before posting just in case of a problem
			fs.writeFileSync(logFile, payload = JSON.stringify(payload, null, ''));
			
			// TEMPORARY!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			// console.log(payload);
			fs.writeFileSync(logFile, '[]');
			fs.writeFileSync(sessionFile, JSON.stringify({ sid: sid, seqId: seqId, sessionExpiration: sessionExpiration }));
			/*
			// send the request
			request({
				uri: url,
				method: 'POST',
				body: payload
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					// when the request finishes successfully, remove the events from disk
					var evts = JSON.parse(fs.readFileSync(logFile)),
						i = 0,
						p;
					
					for (; i < evts.length; i++) {
						if (ids[evts[i].id]) {
							evts.splice(i--, 1);
							delete ids[evts[i].id];
						}
					}
					
					fs.writeFileSync(logFile, JSON.stringify(evts));
					
					// make sure we save the latest seqId
					fs.writeFileSync(sessionFile, JSON.stringify({ sid: sid, mid: mid, seqId: seqId }));
				}
			});
			*/
		}
	});
});
