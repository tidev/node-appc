/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var child_process = require('child_process'),
	exec = child_process.exec,
	spawn = child_process.spawn,
	async = require('async'),
	path = require('path'),
	crypto = require('crypto'),
	util = require('./util'),
	exception = require('./exception'),
	fs = require('fs'),
	afs = require('./fs'),
	plist = require('./plist'),
	version = require('./version'),
	cached;

exports.detect = function (finished, opts) {
	if (process.platform != 'darwin') return finished();
	if (cached) return finished(cached);

	opts = opts || {};

	async.parallel([
		function (callback) {
			var searchDirs = ['/Developer'],
				xcodeInfo = {},
				xcodeBuildTasks = [];

			// first we build up a full list of places to check for xcodebuild
			fs.lstatSync('/Applications').isDirectory() && fs.readdirSync('/Applications').forEach(function (dir) {
				/^Xcode.*\.app$/.test(dir) && searchDirs.push('/Applications/' + dir + '/Contents/Developer');
			});
			fs.lstatSync('/Volumes').isDirectory() && fs.readdirSync('/Volumes').forEach(function (dir) {
				var vol = '/Volumes/' + dir;
				searchDirs.push(vol + '/Developer');
				afs.exists(vol + '/Applications') && fs.lstatSync(vol + '/Applications').isDirectory() && fs.readdirSync(vol + '/Applications').forEach(function (dir) {
					/^Xcode.*\.app$/.test(dir) && searchDirs.push(vol + '/Applications/' + dir + '/Contents/Developer');
				});
			});

			// TODO: try to use spotlight to find additional Xcode locations: "mdfind kMDItemDisplayName==Xcode&&kMDItemKind==Application"

			exec('xcode-select -print-path', function (err, stdout, stderr) {
				var selected = err ? '' : stdout.trim(),
					sdkRegExp = /^iPhone(OS|Simulator)(.+)\.sdk$/;

				searchDirs.indexOf(selected) == -1 && searchDirs.push(selected);

				function getSDKs() {
					var dir = path.join.apply(null, Array.prototype.slice.call(arguments)),
						vers = [];

					afs.exists(dir) && fs.readdirSync(dir).forEach(function (d) {
						var file = path.join(dir, d),
							stat = fs.lstatSync(file);
						if (stat.isDirectory() || (stat.isSymbolicLink() && fs.lstatSync(fs.realpathSync(file)).isDirectory())) {
							var m = d.match(sdkRegExp);
							m && (!opts.minSDK || version.gte(m[2], opts.minSDK)) && vers.push(m[2]);
						}
					});

					return vers;
				}

				async.parallel(searchDirs.sort().map(function (dir) {
					return function (cb) {
						var m = dir.match(/^(.+?\/Xcode.*\.app)\//),
							xcodeapp = m ? m[1] : path.join(dir, 'Applications', 'Xcode.app'),
							xcodebuild = path.join(dir, 'usr', 'bin', 'xcodebuild'),
							plistfile = path.join(path.dirname(dir), 'version.plist'),
							p, info, key;

						if (afs.exists(xcodebuild) && afs.exists(plistfile)) {
							p = new plist(plistfile);
							info = {
								path: dir,
								xcodeapp: xcodeapp,
								xcodebuild: xcodebuild,
								selected: dir == selected,
								version: p.CFBundleShortVersionString,
								build: p.ProductBuildVersion,
								sdks: null,
								sims: null
							};
							key = info.version + ':' + info.build;

							// if we already have this version of Xcode, ignore unless it's currently the selected version
							if (!xcodeInfo[key] || info.selected || dir <= xcodeInfo[key].path) {
								xcodeInfo[key] = info;
								info.selected && (xcodeInfo.__selected__ = info);
								info.sdks = getSDKs(dir, 'Platforms', 'iPhoneOS.platform', 'Developer', 'SDKs');
								info.sims = getSDKs(dir, 'Platforms', 'iPhoneSimulator.platform', 'Developer', 'SDKs');
							}
						}
						cb();
					};
				}), function () {
					callback(null, xcodeInfo);
				});
			});
		},

		function (callback) {
			var enc = require('./encoding'),
				child = spawn('security', ['dump-keychain']),
				out = [],
				err = [];

			child.stdout.on('data', function (data) {
				out.push(data.toString());
			});

			child.stderr.on('data', function (data) {
				err.push(data.toString());
			});

			child.on('exit', function (code) {
				var devNames = {},
					distNames = {},
					result = {
						keychains: {},
						wwdr: false
					};

				if (code) {
					result.error = new exception('Failed during "security dump-keychain"', err.join('').split('\n'));
					callback(null, result);
				} else {
					var keychainCache = {},
						keychainCacheFile = afs.resolvePath('~', '.titanium', 'ios-keychain-cache.json');

					if (afs.exists(keychainCacheFile)) {
						try {
							keychainCache = JSON.parse(fs.readFileSync(keychainCacheFile));
						} catch (ex) {}
					}

					async.series(out.join('').split('keychain: ').map(function (line) {
						return function (next) {
							// check if this cert is one we care about
							var m = line.match(/"alis"<blob>=[^"]*"(?:(?:iPhone (Developer|Distribution)\: (.*))|(Apple Worldwide Developer Relations Certification Authority))"/);
							if (!m) {
								next();
								return;
							}

							if (m[3]) {
								result.wwdr = true;
								next();
								return;
							}

							var type = m[1].toLowerCase(),
								name = enc.decodeOctalUTF8(m[2]),
								keychain = line.match(/^\s*"(.+)"/),
								hash = crypto.createHash('md5').update(line).digest('hex'),
								cache = keychainCache[name];

							// if we find a dupe, move on to the next cert
							if (devNames[name] || distNames[name]) {
								next();
								return;
							}

							// mark that we've visited this cert name
							if (type == 'developer') {
								devNames[name] = 1;
							} else if (type == 'distribution') {
								distNames[name] = 1;
							}

							// if we don't have a keychain, then go on to the next one
							if (!keychain) {
								next();
								return;
							}

							// make sure the destination exists
							result.keychains[keychain[1]] || (result.keychains[keychain[1]] = {});
							result.keychains[keychain[1]][type] || (result.keychains[keychain[1]][type] = []);

							// check if this cert info is cached
							if (cache && cache.hash == hash) {
								var info = {
									name: name
								};
								cache.before && (info.before = new Date(cache.before));
								cache.after && (info.after = new Date(cache.after));
								info.expired = info.after ? info.after < new Date : false;
								info.invalid = info.expired || (info.before ? info.before > new Date : false);

								result.keychains[keychain[1]][type].push(info);
								next();
								return;
							}

							// not cached, need to find every cert and call openssl to get the cert dates
							var opensslChild = spawn('openssl', ['x509', '-dates']),
								certChild = spawn('security', ['find-certificate', '-c', name, '-p', keychain[1]]),
								buf = '';

							certChild.stdout.pipe(opensslChild.stdin);

							opensslChild.stdout.on('data', function (data) {
								buf += data.toString();
							});

							opensslChild.on('exit', function (code) {
								var info = {
									name: name
								};

								// find the dates
								buf.split('\n').forEach(function (line) {
									var m = line.match(/not(Before|After)=(.+)/);
									if (m) {
										info[m[1].toLowerCase()] = new Date(m[2]);
									}
								});

								info.expired = info.after ? info.after < new Date : false;
								info.invalid = info.expired || (info.before ? info.before > new Date : false);

								// add the cert info to the keychain cache
								keychainCache[name] = {
									hash: hash,
									name: name,
									before: info.before,
									after: info.after
								};
								result.keychains[keychain[1]][type].push(info);

								next();
							});
						};
					}), function () {
						// write the keychain cache
						fs.writeFileSync(keychainCacheFile, JSON.stringify(keychainCache, null, '\t'));

						// sort the names
						Object.keys(result.keychains).forEach(function (kc) {
							result.keychains[kc].developer && result.keychains[kc].developer.sort(function (a, b) { return a.name > b.name; });
							result.keychains[kc].distribution && result.keychains[kc].distribution.sort(function (a, b) { return a.name > b.name; });
						});
						callback(null, result);
					});
				}
			});
		},

		function (callback) {
			var dir = afs.resolvePath('~/Library/MobileDevice/Provisioning Profiles'),
				provisioningProfiles = {
					adhoc: [],
					enterprise: [],
					development: [],
					distribution: []
				};

			afs.exists(dir) && fs.readdirSync(dir).forEach(function (file) {
				if (/.+\.mobileprovision$/.test(file)) {
					var contents = fs.readFileSync(path.join(dir, file)).toString(),
						i = contents.indexOf('<?xml'),
						j = contents.lastIndexOf('</plist>'),
						p,
						dest = 'development',
						appPrefix,
						entitlements,
						expired = false;

					if (i != -1 && j != -1) {
						p = new plist().parse(contents.substring(i, j + 8));
						appPrefix = (p.ApplicationIdentifierPrefix || []).shift();
						entitlements = p.Entitlements || {};

						if (!p.ProvisionedDevices || !p.ProvisionedDevices.length) {
							dest = 'distribution';
						} else if (new Buffer(p.DeveloperCertificates[0], 'base64').toString().indexOf('Distribution:') != -1) {
							dest = 'adhoc';
						}

						try {
							if (p.ExpirationDate) {
								expired = new Date(p.ExpirationDate) < new Date;
							}
						} catch (e) {}

						provisioningProfiles[dest].push({
							uuid: p.UUID,
							name: p.Name,
							appPrefix: appPrefix,
							creationDate: p.CreationDate,
							expirationDate: p.ExpirationDate,
							expired: expired,
							appId: (entitlements['application-identifier'] || '').replace(appPrefix + '.', ''),
							getTaskAllow: entitlements['get-task-allow'] || '',
							apsEnvironment: entitlements['aps-environment'] || ''
						});
					}
				}
			});

			callback(null, provisioningProfiles);
		},

		function (callback) {
			var result = [];
			exec('security list-keychains', function (err, stdout, stderr) {
				if (!err) {
					result = result.concat(stdout.split('\n').filter(function (line) {
						var m = line.match(/[^"]*"([^"]*)"/);
						m && result.push(m[1].trim());
					}));
				}
			});
			callback(null, result);
		}

	], function (err, results) {
		finished(cached = {
			xcode: results[0],
			certs: results[1],
			provisioningProfiles: results[2],
			keychains: results[3]
		});
	});
};
