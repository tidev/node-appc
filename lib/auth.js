/**
 * Performs authentication tasks including logging in the Appcelerator Platform,
 * logging out, and checking session status.
 *
 * @module auth
 *
 * @copyright
 * Copyright (c) 2014 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var __ = require('./i18n')(__dirname).__,
	fs = require('fs'),
	path = require('path'),
	uuid = require('node-uuid'),
	wrench = require('wrench'),
	request = require('request'),
	authApiServer = require('./authapiserver'),

	defaultDashboardHost = "https://dashboard.appcelerator.com",
	defaultDashboardAuthPath = "/api/v1/auth/login";


/**
 * Authenticates a user into the Appcelerator Network.
 * @param {Object} args - Login arguments
 * @param {String} args.username - The email address to log in as
 * @param {String} args.password - The password
 * @param {Function} args.callback(error, result) - The function to call once logged in or on error
 * @param {String} [args.titaniumHomeDir] - The Titanium home directory where the session files are stored
 * @param {String} [args.loginUrl] - The URL to authenticate against
 * @param {String} [args.proxy] - The proxy server to use
 */
exports.login = function login(args) {
	args || (args = {});

	var dashboardHost = args.dashboardHost || defaultDashboardHost;
    var dashboardLoginUrl =  dashboardHost + defaultDashboardAuthPath;

    var cb = args.callback || {};

    request({
			uri: dashboardLoginUrl,
			method: 'POST',
			proxy: args.proxy,
			jar: false, // don't save cookies
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			rejectUnauthorized: args.rejectUnauthorized === undefined ? true : !!args.rejectUnauthorized,
			body: net.urlEncode({
				username: args.username,
				password: args.password
			})
		}, function (error, response, body) {
				try {
					if (error) {
						throw new Error(__('Error communicating with the Appcelerator Platform server: %s', error));
					}

					if (response.statusCode == 200) {
		                try {
		                    var result = JSON.parse(body);
		                } catch (e) {
		                    return cb(__('Bad response from Appcelerator Platform server: ') + body, null);
		                }
		                if (result.success) {
		                    // Find sid from the cookies header.
		                    var cookies = response.headers['set-cookie'];
		                    if(!cookies) {
		                        return cb(__('Bad response from Appcelerator Platform : No cookie info'), null);
		                    }

		                    var sid = null;
		                    cookies.forEach(function(cookie) {
		                        if(cookie.indexOf('connect.sid=') !== 0) {
		                            return;
		                    	}
		                        sid = (cookie+'').split(';')[0].split('=')[1];
		                    });

		                    // add logged in appcelerator platform server details and new API server details to the args.
		                    if (result.result && result.result.apiServer)
		                    {
		                 	   args.loginUrl = result.result.apiServer;
		                	}
		                    args.dashboardHost = dashboardHost;
		                    args.sid = sid; 
		                    authApiServer.login(args);

		                    // Write the organization details into the 360 session file.
		                    exports.getOrganizations(args);
		                } else {
		                    cb(__('Invalid Appcelerator 360 User: ') + result.description || '', null);
		                }
		            } else if (response.statusCode == 400) {
		                // invalid login, authentication error
		                cb(__('Invalid login: ') + result.description||'', null);

		            } else {
		                cb(__('Invalid response code (' + res.statusCode + ') from Appcelerator 360.'), null);
		            }
				} catch (ex) {
					args.callback(ex);
				}
		});
};


/**
 * Retrieves the organization details of the user from the Appcelerator Platform. This will return the json array 
 * containing the list of organization's id and name.
 *
 * @param {Object} args - Organization arguments
 * @param {String} [args.username] email of the user currently logging in
 * @param {String} [args.sid] session id from dashboard
 * @param {String} [args.titaniumHomeDir] - The Titanium home directory where the session files are stored
 * @param {String} [args.proxy] - The proxy server to use
 * @param {Function} args.callback(error, result) - The function to call once logged out or on error
 */
exports.getOrganizations = function getOrganizations(args) {

    var cb = args.callback || {};
	var session = authApiServer.getSessionInfo();
	if (!session.loggedIn)
	{
		// Don't do anything for now, if the user is not logged in.
		cb(null, {"loggedIn": false});
	}
	var dashboardHost = (session.data ? session.data.dashboardHost : undefined) || defaultDashboardHost;

    var url = dashboardHost + "/api/v1/user/organizations";

    //curl -i -b connect.sid=s%3AaJaL7IWQ_cDvmVBeQRY997hf.vVzLV2aFvrYiEKmfdTARTuHessesQ0Xm87JvFESaus http://dashboard.appcelerator.com/api/v1/user/organizations
    request({
			uri: url,
			method: 'GET',
			proxy: args.proxy,
			headers: {
				'Cookie': 'connect.sid=' + args.sid,
        		'Content-Type': 'application/x-www-form-urlencoded'
			}
		}, function (error, response, body) {
				try {
					if (error) {
						throw new Error(__('Error communicating with the Appcelerator Platform server: %s', error));
					}

					if (response.statusCode == 200) {
		                try {
		                    var result = JSON.parse(body);
		                } catch (e) {
		                    return cb(__('Bad response for user organization info from Appcelerator 360: ') + data, null);
		                }
		                if (result.success) {
		                    if(!result.result || Object.prototype.toString.call(result.result) !== '[object Array]' || result.result.length == 0) {
		                        return cb(__("Bad response from Appcelerator 360: no organization info. ") + result, null);
		                    }

		                    var orgs = [];
		                    result.result.forEach(function(orgDoc) {
		                        var org = {};
		                        org.id = orgDoc.org_id;
		                        org.name = orgDoc.name;
		                        orgs.push(org);
		                    });

		                    var appcSession = {
		                    	"orgs" : orgs,
		                    	"sid" : args.sid,
		                    	"username": args.username
		                    };

		                    // Write orgs information to session file.
		                    var titaniumHomeDir = authApiServer.getTitaniumHomeDir(args);
		                    var appcSessionFile = path.join(titaniumHomeDir, 'appc_session.json');
		                    fs.writeFile(appcSessionFile, JSON.stringify(appcSession), cb(null, null));

		                    return orgs;
		                } else {
		                    cb(__("Failed to get organization information. ") + result.description || '', null);
		                }
		            } else if (response.statusCode == 400) {
		                // invalid login, authentication error
		                cb(__("Failed to get organization information. ") + result.description || '', null);

		            } else {
		                console.log("Invalid response code (" + res.statusCode + ") from Appcelerator 360.")
		                cb(__("Invalid response code from Appcelerator Platform Server: ") + res.statusCode, null);
		            }
				} catch (ex) {
					cb(ex);
				}
		});
}

/**
 * Returns whether the user is current logged in.
 *
 * @param {Object} [args] - Status arguments
 * @param {String} [args.titaniumHomeDir] - The Titanium home directory where the session files are stored
 * @returns {Object} An object containing the session status
 */
exports.status = function status(args) {
	//TODO: List organization details of the Appcelerator platform user.
	authApiServer.status(args);
}

/**
 * Returns the machine id (mid) or generates a new one based on the computer's
 * primary network interface's MAC address.
 * @param {String} titaniumHomeDir - The Titanium home directory where the session files are stored
 * @param {Function} callback - A callback to fire with the result
 */
exports.getMID = function getMID(titaniumHomeDir, callback) {
	authApiServer.getMID(titaniumHomeDir, callback);
}

/**
 * Logs the user out of the Appcelerator Platform and API server.
 *
 * @param {Object} args - Logout arguments
 * @param {Function} args.callback(error, result) - The function to call once logged out or on error
 * @param {String} [args.titaniumHomeDir] - The Titanium home directory where the session files are stored
 * @param {String} [args.logoutUrl] - The URL to use to end session
 * @param {String} [args.proxy] - The proxy server to use
 */
exports.logout = function logout(args) {
	var titaniumHomeDir = authApiServer.getTitaniumHomeDir(args);
	var appcSessionFile = path.join(titaniumHomeDir, 'appc_session.json');

	createLoggedOutAppcSessionFile(appcSessionFile);
	authApiServer.logout(args);
}

/**
 * Creates the session file with a logged out status for Appcelerator Platform.
 *
 * @param {String} sessionFile - Path to the session file.
 * @returns {Object} An object contain the logged out session status
 * @private
 */
function createLoggedOutAppcSessionFile(sessionFile) {
	var result = {},
		titaniumHomeDir = path.dirname(sessionFile),
		session, loggedIn;
	try {
		session = JSON.parse(fs.readFileSync(sessionFile));
		loggedIn = session.loggedIn;
		if (!fs.existsSync(titaniumHomeDir)) {
			wrench.mkdirSyncRecursive(titaniumHomeDir);
		}
		fs.writeFileSync(sessionFile, JSON.stringify(result));
	} catch (e) {
		result.loggedIn = loggedIn;
		result.error = e;
	}
	return result;
}
