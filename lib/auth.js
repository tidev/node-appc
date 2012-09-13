/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var request = require('request'),
	path = require('path'),
	fs = require('fs'),
	crypto = require('crypto'),
	querystring = require('querystring'),
	https = require('https'),

	interfaces = require('./net').interfaces,
	afs = require('./fs'),
	analytics = require('./analytics'),

	loginHost = 'api.appcelerator.net',
	loginPath = '/p/v1/sso-login',
	logoutHost = 'api.appcelerator.net',
	logoutPath = '/p/v1/sso-logout',

	sessionFile = afs.resolvePath('~', '.titanium', 'auth_session.json'),

	mid;

exports.login = function (username, password, callback) {

	var message = querystring.stringify({
			un: username,
			pw: password,
			mid: mid
		}),
		options = {
			host: loginHost,
			path: loginPath,
			port: 443,
			method: "POST",
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': message.length
			}
		},
		req;

	// Otherwise we need to re-auth with the server
	req = https.request(options, function(res) {
		res.on('data', function(e) {

			var responseValid = false,
				result,
				response,
				cookie,
				p;

			try {
				response = JSON.parse(e.toString());
				if (response.success) {
					cookie = res.headers['set-cookie'];
					if (cookie.length === 1 && cookie[0].match("^PHPSESSID")) {
						responseValid = true;

						// Create the result
						result = {
							loggedIn: true,
							cookie: cookie[0],
							data: {}
						};

						// Copy over response, excluding redundant or irrelevant information
						for(p in response) {
							if (p !== 'success' && p !== 'attributes') {
								result.data[p] = response[p];
							}
						}

						// Write the data out to the session file
						fs.writeFileSync(sessionFile, JSON.stringify(result));
					}
				} else if (response.code === 4 || response.code === 5){
					responseValid = true;
					result = {
						error: "Invalid username or password combination. If you have forgotten your password, please visit https://my.appcelerator.com/"
					};
					createLoggedOutSessionFile();
				}
			} catch(e) {}

			if (!responseValid) {
				result = {
					error: "Invalid server response"
				};
				createLoggedOutSessionFile();
			}
			callback && callback(result);
		});
	});

	req.write(message);
	req.end();

	req.on('error', function(e) {
		createLoggedOutSessionFile();
		callback && callback({
			error: "Error communicating with the server: " + e
		});
	});
};

exports.logout = function (callback) {

	var result,
		session,
		req;

	if (fs.existsSync(sessionFile)) {
		try {
			session = JSON.parse(fs.readFileSync(sessionFile));
			if (session.loggedIn) {

				req = https.request({
					host: logoutHost,
					path: logoutPath,
					port: 443,
					method: "GET",
					headers: {
						'Cookie': session.cookie
					}
				}, function(res) {
					res.on('data', function(e) {
						try {
							response = JSON.parse(e.toString());
							if (response.success) {
								result = createLoggedOutSessionFile();
								callback && callback(mix(result, { success: true }));
							} else {
								callback && callback({
									error: "Error logging out from server: " + response.reason
								});
							}
						} catch(e) {
							callback && callback({
								error: "Invalid server response"
							});
						}
					});
				});

				req.end();

				req.on('error', function(e) {
					callback && callback({
						error: "Error communicating with the server: " + e
					});
				});
			} else {
				callback && callback(mix(session, { success: true }));
			}
		} catch(e) { // Invalid session file. This should never happen
			result = createLoggedOutSessionFile();
			callback && callback(mix(result, { success: true }));
		}
	} else { // Create a default (logged out, expired) session file
		result = createLoggedOutSessionFile();
		callback && callback(mix(result, { success: true }));
	}
};

exports.status = function (callback) {

	var result = {},
		session;

	if (fs.existsSync(sessionFile)) {
		try {

			// Fetch and parse the session data
			session = JSON.parse(fs.readFileSync(sessionFile));
			result = {
				loggedIn: session.loggedIn
			};
			if (!session.loggedIn) {
				// If we are offline, calculated whether or not we are expired
				if (session.offlineExpires) {
					result.offlineExpires = session.offlineExpires;
					result.expired = result.offlineExpires < Date.now();
				} else {
					result.expired = true;
				}
			}
		} catch(e) { // Invalid session file. This should never happen
			result = mix(createLoggedOutSessionFile(), { expired: true });
		}
	} else {
		result =  mix(createLoggedOutSessionFile(), { expired: true }); // No prior history, create a new logged out file
	}

	callback && callback(result);
};

exports.getMID = function (callback) {
	if (mid) {
		callback && callback(mid);
	} else {
		var midFile = afs.resolvePath('~', '.titanium', 'mid.json');
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
			mid = crypto.createHash('md5').update(macAddress).digest("hex");
			fs.writeFileSync(midFile, JSON.stringify({ mid: mid }));

			// Enroll in analytics, since creating a new MID is basically a new installation
			analytics.enroll();

			callback && callback(mid);
		});
	}
};

function createLoggedOutSessionFile() {

	var offlineExpires,
		session,
		result = { loggedIn: false };

	// Read the existing file to parse out the previous session_allowed_duration, if it exists
	if (fs.existsSync(sessionFile)) {
		try {
			session = JSON.parse(fs.readFileSync(sessionFile));
			if (session.loggedIn) {
				offlineExpires = session.data && session.data.session_allowed_duration;
			}
		} catch(e) {}
	}

	// Create the new session file
	offlineExpires && (result.offlineExpires = Date.now() + offlineExpires * 60 * 60 * 1000);
	fs.writeFileSync(sessionFile, JSON.stringify(result));

	// Add the expired flag and return
	return result;
}