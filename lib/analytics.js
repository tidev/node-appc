/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var request = require('request'),
	url = 'https://api.appcelerator.net/p/v2/mobile-track',
	path = require('path'),
	crypto = require('crypto'),
	uuid = require('node-uuid'),
	wrench = require('wrench'),
	fs = require('fs'),
	net = require('./net'),
	appcfs = require('./fs'),
	events = [],
	timeout = 60 * 60 * 1000; // 1 hour

function timestamp() {
	return (new Date).toISOString().replace('Z', "+0000");
}

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

exports.send = function (appId, appName, directory, appGuid, version, deployType) {
	var payload = [],
		seqId = 0,
		sid,
		mid,
		ids = {};
	
	directory = appcfs.resolvePath(directory);
	appcfs.exists(directory) || wrench.mkdirSyncRecursive(directory);
	
	deployType = deployType || 'production';
	
	function add(type, event, id, ts, data) {
		ids[evt.id] = 1;
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
	
	// have we already done enroll?
	var settingsFile = path.join(directory, 'settings');
	if (appcfs.exists(settingsFile)) {
		try {
			var x = JSON.parse(fs.readFileSync(settingsFile));
			sid = x.sid;
			mid = x.mid;
		} catch (e) {
			// file was malformed, treat as if a new session
			sid = uuid.v4();
		}
	}
	
	if (mid) {
		finish();
	} else {
		net.interfaces(function (ifaces) {
			// find the mac address of the local ethernet card
			var macAddress,
				names = Object.keys(ifaces).sort();
			for (var i = 0; i < names.length; i++) {
				var j = ifaces[names[i]];
				if (j.macAddress) {
					macAddress = j.macAddress;
					if (/^eth|en|Local Area Connection/.test(j)) {
						break;
					}
				}
			}
			macAddress || (macAddress = uuid.v4());
			
			mid = crypto.createHash('md5').update(macAddress).digest("hex");
			sid = sid || uuid.v4();
			fs.writeFileSync(settingsFile, JSON.stringify({ sid: sid, mid: mid }));
			
			add('ti.enroll', 'ti.enroll', null, null, {
				app_name: appName || 'node-appc',
				oscpu: 1,
				mac_addr: macAddress,
				deploytype: deployType,
				ostype: process.platform,
				osarch: process.arch,
				app_id: appId,
				platform: 'node',
				model: undefined
			});
			
			finish();
		});
	}
	
	function finish() {
		var logFile = path.join(directory, 'data.log'),
			logExists = appcfs.exists(logFile),
			logMtime = logExists ? fs.statSync(logFile).mtime : 0;
		
		// when was the last event?
		if (!logExists || Date.now() - logMtime > timeout) {
			if (logExists) {
				// add the ti.end event
				add('ti.end', 'ti.end', null, logMtime);
				// need to generate a new session id
				fs.writeFileSync(settingsFile, JSON.stringify({ sid: sid = uuid.v4(), mid: mid }));
			}
			
			// then do start
			add('ti.start', 'ti.start', {
				// TODO: also send os name, os version, os arch, cpu count, node version, npm version
				tz: (new Date).getTimezoneOffset(),
				deploytype: deployType,
				os: process.platform,
				osver: '',
				version: process.version,
				platform: 'node',
				model: undefined,
				un: null,
				app_version: version,
				nettype: null
			});
		}
		
		// add the list of app.feature events
		events.forEach(function (evt) {
			add(evt.type, evt.name, evt.id, evt.ts, evt.data);
		});
		
		// append payload to disk
		if (appcfs.exists(logFile)) {
			payload = JSON.parse(fs.readFileSync(logFile)).concat(payload);
		}
		fs.writeFileSync(logFile, payload = JSON.stringify(payload));
		
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
			}
		});
	}
};