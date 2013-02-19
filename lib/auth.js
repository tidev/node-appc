/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var i18n = require('./i18n')(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	fs = require('fs'),
	crypto = require('crypto'),
	uuid = require('node-uuid'),
	wrench = require('wrench'),
	request = require('request'),
	urlEncode = require('./net').urlEncode,
	
	mix = require('./util').mix,

	interfaces = require('./net').interfaces,
	afs = require('./fs'),
	analytics = require('./analytics'),

	loginUrl = 'https://api.appcelerator.net/p/v1/sso-login',
	logoutUrl = 'https://api.appcelerator.net/p/v1/sso-logout',
	myAppc = 'https://my.appcelerator.com/',

	titaniumConfigFolder = afs.resolvePath('~', '.titanium'),
	sessionFile = afs.resolvePath(titaniumConfigFolder, 'auth_session.json'),
	
	statusCache,
	mid;

exports.login = function (username, password, callback, proxy) {
	statusCache = null;
	
	// Otherwise we need to re-auth with the server
	request({
		uri: loginUrl,
		method: 'POST',
		proxy: proxy || undefined,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: urlEncode({
			un: username,
			pw: password,
			mid: mid
		})
	}, function(error, response, body) {
		try {
			if (error) {
				throw new Error(__('Error communicating with the server: %s', error));
			}
			
			var res = JSON.parse(body);
			if (res.success) {
				var cookie = response.headers['set-cookie'];
				if (cookie.length === 1 && cookie[0].match('^PHPSESSID')) {
					// Create the result
					var result = {
						loggedIn: true,
						cookie: cookie[0],
						data: {
							uid: res.uid,
							guid: res.guid,
							email: res.email
						}
					};

					// Write the data out to the session file
					if (!afs.exists(titaniumConfigFolder)) {
						wrench.mkdirSyncRecursive(titaniumConfigFolder);
					}
					fs.writeFileSync(sessionFile, JSON.stringify(result));
					
					callback && callback(result);
				}
			} else if (res.code === 4 || res.code === 5) {
				throw new Error(__('Invalid username or password. If you have forgotten your password, please visit %s.', myAppc.cyan));
			} else {
				throw new Error(__('Invalid server response'));
			}
		} catch(e) {
			callback && callback({
				error: e
			});
			createLoggedOutSessionFile();
		}
	});
};

exports.logout = function (callback, proxy) {
	var session;
	
	statusCache = null;
	
	if (fs.existsSync(sessionFile)) {
		try {
			session = JSON.parse(fs.readFileSync(sessionFile));
			if (session.loggedIn) {
				request({
					uri: logoutUrl,
					method: 'GET',
					proxy: proxy || undefined,
					headers: {
						'Cookie': session.cookie
					}
				}, function(error, response, body) {
					var result = createLoggedOutSessionFile();
					try {
						if (error) {
							throw new Error(__('Error communicating with the server: %s', error));
						}
						
						var res = JSON.parse(body);
						if (res.success) {
							mix(result, { success: true, alreadyLoggedOut: false });
						} else {
							throw new Error(__('Error logging out from server: %s', res.reason));
						}
					} catch (e) {
						result.error = e;
					}
					callback && callback(result);
				});
			} else {
				callback && callback(mix(session, { success: true, alreadyLoggedOut: true }));
			}
		} catch(e) { // Invalid session file. This should never happen
			callback && callback(mix(createLoggedOutSessionFile(), { success: true, alreadyLoggedOut: true }));
		}
	} else { // Create a default (logged out) session file
		callback && callback(mix(createLoggedOutSessionFile(), { success: true, alreadyLoggedOut: true }));
	}
};

exports.status = function () {
	if (statusCache) return statusCache;
	
	var result = {},
		session;
	
	if (fs.existsSync(sessionFile)) {
		try {
			// Fetch and parse the session data
			session = JSON.parse(fs.readFileSync(sessionFile));
			result = {
				loggedIn: session.loggedIn,
				uid: session.data && session.data.uid,
				guid: session.data && session.data.guid,
				email: session.data && session.data.email,
				cookie: session.cookie
			};
		} catch(e) { // Invalid session file. This should never happen
			result = createLoggedOutSessionFile();
		}
	} else {
		result = createLoggedOutSessionFile(); // No prior history, create a new logged out file
	}
	
	return statusCache = result;
};

exports.getMID = function (callback) {
	if (mid) {
		callback && callback(mid);
	} else {
		var midFile = afs.resolvePath(titaniumConfigFolder, 'mid.json');
		if (afs.exists(midFile)) {
			try {
				mid = JSON.parse(fs.readFileSync(midFile)).mid;
				if (mid) {
					callback(mid);
					return;
				}
			} catch (e) {} // File/MID entry doesn't exist, so we need to recreate it
		}

		// If it got here, we couldn't fetch the previous MID
		interfaces(function (ifaces) {

			// Find the MAC address of the local ethernet card
			var macAddress,
				names = Object.keys(ifaces).sort(),
				i, j;
			for (i = 0; i < names.length; i++) {
				j = ifaces[names[i]];
				if (j.macAddress) {
					macAddress = j.macAddress;
					if (/^eth|en|Local Area Connection/.test(j)) {
						break;
					}
				}
			}
			macAddress || (macAddress = uuid.v4());

			// Create the MID, using the MAC address as a seed
			mid = crypto.createHash('md5').update(macAddress).digest('hex');

			// Write the MID to its file
			if (!fs.existsSync(titaniumConfigFolder)) {
				wrench.mkdirSyncRecursive(titaniumConfigFolder);
			}
			fs.writeFileSync(midFile, JSON.stringify({ mid: mid }));

			callback && callback(mid);
		});
	}
};

function createLoggedOutSessionFile() {
	var result = { loggedIn: false };
	if (!fs.existsSync(titaniumConfigFolder)) {
		wrench.mkdirSyncRecursive(titaniumConfigFolder);
	}
	fs.writeFileSync(sessionFile, JSON.stringify(result));
	return result;
}