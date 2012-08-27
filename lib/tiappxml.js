/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var fs = require('fs'),
	path = require('path'),
	afs = require('./fs'),
	wrench = require('wrench'),
	xml = require('./xml'),
	DOMParser = require('xmldom').DOMParser;

function toXml(dom, parent, name, value) {
	var node = dom.create(name, null, parent),
		doIndent = true;
	
	switch (name) {
		case 'deployment-targets':
			Object.keys(value).forEach(function (v) {
				dom.create('target', {
					device: v,
					nodeValue: value[v]
				}, node);
			});
			break;
		
		case 'iphone':
			value.orientations && Object.keys(value.orientations).forEach(function (o) {
				dom.create('orientations', { device: o }, node, function (orientations) {
					value.orientations[o].forEach(function (p) {
						dom.create('orientation', { nodeValue: p }, orientations);
					});
				});
			});
			break;
		
		case 'android':
			node.setAttribute('xmlns:android', 'http://schemas.android.com/apk/res/android');
			
			if (value.manifest) {
				dom.create('manifest', null, node, function (manifest) {
					if (value.manifest['supports-screens']) {
						dom.create('supports-screens', {
							'android:anyDensity': false
						}, manifest);
					}
					if (value.manifest.application) {
						dom.create('application', null, manifest, function (app) {
							if (value.manifest.application.activity) {
								dom.create('activity', null, app, function (activity) {
									Object.keys(value.manifest.application.activity).forEach(function (a) {
										if (a == 'intent-filter') {
											dom.create('intent-filter', null, activity, function (intentFilter) {
												value.manifest.application.activity[a].forEach(function (i, j, arr) {
													dom.create(i.type, {
														'android:name': i.name
													}, intentFilter);
												});
											});
										} else {
											activity.setAttribute('android:' + a, ''+value.manifest.application.activity[a]);
										}
									});
								});
							}
						});
					}
				});
			}
			
			if (value.activity) {
				dom.create('activity', {
					'android:name': value.activity.name
				}, node);
			}
			
			if (value.services) {
				dom.create('services', null, node, function (services) {
					value.services.forEach(function (s) {
						dom.create('service', {
							type: s.type,
							url: s.url
						}, services);
					});
				});
			}
			break;
		
		case 'mobileweb':
			Object.keys(value).forEach(function (prop) {
				switch (prop) {
					case 'build':
						dom.create('build', null, node, function (build) {
							Object.keys(value.build).forEach(function (name) {
								dom.create(name, null, build, function (deployment) {
									Object.keys(value.build[name]).forEach(function (d) {
										var val = value.build[name][d];
										switch (d) {
											case 'js':
											case 'css':
											case 'html':
												dom.create(d, null, deployment, function (type) {
													Object.keys(val).forEach(function (v) {
														dom.create(v, { nodeValue: val[v] }, type);
													});
												});
												break;
											
											default:
												dom.create(d, { nodeValue: val }, deployment);
										}
									});
								});
							});
						});
						break;
					
					case 'analytics':
					case 'filesystem':
					case 'map':
					case 'splash':
					case 'unsupported-platforms':
						dom.create(prop, null, node, function (section) {
							Object.keys(value[prop]).forEach(function (key) {
								dom.create(key, { nodeValue: value[prop][key] }, section);
							});
						});
						break;
					
					case 'precache':
						dom.create('precache', null, node, function (precache) {
							Object.keys(value[prop]).forEach(function (type) {
								value[prop][type].forEach(function (n) {
									dom.create(type, { nodeValue: n }, precache);
								});
							});
						});
						break;
					
					default:
						dom.create(prop, { nodeValue: value[prop] }, node);
				}
			});
			break;
		
		case 'modules':
			value.forEach(function (mod) {
				dom.create('module', {
					platform: mod.platform,
					version: mod.version,
					nodeValue: mod.id
				}, node);
			});
			break;
		
		default:
			node.appendChild(dom.createTextNode(value));
			doIndent = false;
	}
	
	doIndent && node.appendChild(dom.createTextNode('\r\n' + new Array(2).join('\t')));
}

function toJS(obj, doc) {
	var node = doc.firstChild;
	while (node) {
		if (node.nodeType == xml.ELEMENT_NODE) {
			switch (node.tagName) {
				case 'deployment-targets':
					var targets = obj['deployment-targets'] = {};
					xml.forEachElement(node, function (elem) {
						var dev = xml.getAttr(elem, 'device');
						dev && (targets[dev] = xml.getValue(elem));
					});
					break;
				
				case 'iphone':
					var iphone = obj.iphone = { orientations: {} };
					xml.forEachElement(node, function (elem) {
						var dev = xml.getAttr(elem, 'device');
						if (dev) {
							iphone.orientations[dev] || (iphone.orientations[dev] = []);
							xml.forEachElement(elem, function (elem) {
								iphone.orientations[dev].push(xml.getValue(elem));
							});
						}
					});
					break;
				
				case 'android':
					var android = obj.android = {};
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'manifest':
								var manifest = android.manifest = {};
								xml.forEachElement(elem, function (elem) {
									switch (elem.tagName) {
										case 'supports-screens':
											manifest['supports-screens'] = [];
											// TODO: populate supports-screens
											break;
										
										case 'application':
											var application = manifest.application = {};
											xml.forEachElement(elem, function (elem) {
												if (elem.tagName == 'activity') {
													var activity = application.activity = {
															alwaysRetainTaskState: xml.getAttr(elem, 'android:alwaysRetainTaskState'),
															configChanges: xml.getAttr(elem, 'android:configChanges'),
															label: xml.getAttr(elem, 'android:label'),
															name: xml.getAttr(elem, 'android:name'),
															theme: xml.getAttr(elem, 'android:theme'),
															'intent-filter': []
														}
													xml.forEachElement(elem, function (elem) {
														if (elem.tagName == 'intent-filter') {
															xml.forEachElement(elem, function (elem) {
																activity['intent-filter'].push({
																	type: elem.tagName,
																	name: xml.getAttr(elem, 'android:name')
																});
															});
														}
													});
												}
											});
											break;
									}
								});
								break;
							
							case 'activity':
								android.activity = {
									name: xml.getAttr(elem, 'android:name')
								};
								break;
							
							case 'services':
								var services = android.services = [];
								xml.forEachElement(elem, function (elem) {
									services.push({
										type: xml.getAttr(elem, 'type'),
										url: xml.getAttr(elem, 'url')
									});
								});
								break;
						}
					});
					break;
				
				case 'mobileweb':
					var mobileweb = obj.mobileweb = {};
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'build':
								var build = mobileweb.build = {};
								xml.forEachElement(elem, function (elem) {
									var profile = build[elem.tagName] = {};
									xml.forEachElement(elem, function (elem) {
										switch (elem.tagName) {
											case 'js':
											case 'css':
											case 'html':
												var filetype = profile[elem.tagName] = {};
												xml.forEachElement(elem, function (elem) {
													filetype[elem.tagName] = xml.getValue(elem);
												});
												break;
											
											default:
												profile[elem.tagName] = xml.getValue(elem);
										}
									});
								});
								break;
							
							case 'analytics':
							case 'filesystem':
							case 'map':
							case 'splash':
							case 'unsupported-platforms':
								mobileweb[elem.tagName] = {};
								xml.forEachElement(elem, function (subelem) {
									mobileweb[elem.tagName][subelem.tagName] = xml.getValue(subelem);
								});
								break;
							
							case 'precache':
								var precache = mobileweb.precache = {};
								xml.forEachElement(elem, function (elem) {
									precache[elem.tagName] || (precache[elem.tagName] = []);
									precache[elem.tagName].push(xml.getValue(elem));
								});
								break;
							
							default:
								mobileweb[elem.tagName] = xml.getValue(elem);
						}
					});
					break;
				
				case 'modules':
					var modules = obj.modules = [];
					xml.forEachElement(node, function (elem) {
						modules.push({
							id: xml.getValue(elem),
							platform: xml.getAttr(elem, 'platform'),
							version: xml.getAttr(elem, 'version')
						});
					});
					break;
				
				default:
					obj[node.tagName] = xml.getValue(node);
			}
		}
		node = node.nextSibling;
	}
}

function tiapp(filename) {
	Object.defineProperty(this, 'load', {
		value: function (file) {
			if (!afs.exists(file)) {
				throw new Error('tiapp.xml file does not exist');
			}
			
			var dom = new DOMParser().parseFromString(fs.readFileSync(file).toString(), 'text/xml');
			toJS(this, dom.documentElement);
		}
	});
	
	Object.defineProperty(this, 'toString', {
		value: function (fmt) {
			if (fmt == 'xml') {
				var dom = new DOMParser().parseFromString('<ti:app xmlns:ti="http://ti.appcelerator.org"/>');
				
				dom.create = function (tag, attrs, parent, callback) {
					var node = dom.createElement(tag);
					attrs && Object.keys(attrs).forEach(function (attr) {
						if (attr == 'nodeValue') {
							node.appendChild(dom.createTextNode(''+attrs[attr]));
						} else {
							attrs[attr] != void 0 && node.setAttribute(attr, ''+attrs[attr]);
						}
					});
					if (parent) {
						var indent = 0,
							p = parent;
						while (p.parentNode) {
							indent++;
							p = p.parentNode;
						}
						parent.appendChild(dom.createTextNode('\r\n' + new Array(indent+1).join('\t')));
					}
					parent && parent.appendChild(node);
					if (callback) {
						callback(node);
						node.appendChild(dom.createTextNode('\r\n' + new Array(indent+1).join('\t')));
					}
					return node;
				};
				
				Object.keys(this).forEach(function (key) {
					toXml(dom, dom.documentElement, key, this[key]);
				}, this);
				
				dom.documentElement.appendChild(dom.createTextNode('\r\n'));
				
				return '<?xml version="1.0" encoding="UTF-8"?>\n' + dom.documentElement.toString();
			} else if (fmt == 'pretty-json') {
				return JSON.stringify(this, null, '\t');
			} else if (fmt == 'json') { 
				return JSON.stringify(this);
			}
			return Object.prototype.toString.call(this);
		}
	});
	
	Object.defineProperty(this, 'save', {
		value: function (file) {
			if (file) {
				var dir = path.dirname(file);
				afs.exists(dir) || wrench.mkdirSyncRecursive(dir);
				fs.writeFileSync(file, this.toString('xml'));
			}
		}
	});
	
	filename && this.load(filename);
}

module.exports = tiapp;
