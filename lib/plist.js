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

function PlistType(type, value) {
	this.className = 'PlistType';
	this.type = type;
	this.value = type == 'real' && value == Math.round(value) ? value.toFixed(1) : value;
}

function toXml(dom, parent, it, indent) {
	var i = indent || 0,
		p,
		q = parent,
		type = Object.prototype.toString.call(it);
	
	while (q.parentNode) {
		i++;
		q = q.parentNode;
	}
	
	switch (type) {
		case '[object Object]':
			if (it.className == 'PlistType') {
				dom.create(it.type, { nodeValue: it.value }, parent);
			} else {
				p = dom.create('dict', null, parent);
				Object.keys(it).forEach(function (name) {
					dom.create('key', { nodeValue: name }, p);
					toXml(dom, p, it[name], indent);
				});
				p.appendChild(dom.createTextNode('\r\n' + new Array(i).join('\t')));
			}
			break;
		
		case '[object Array]':
			p = dom.create('array', null, parent);
			it.forEach(function (val) {
				toXml(dom, p, val, indent);
			});
			p.appendChild(dom.createTextNode('\r\n' + new Array(i).join('\t')));
			break;
			
		case '[object Date]':
			dom.create('date', { nodeValue: it.toISOString().replace(/\.\d+Z$/, 'Z') }, parent);
			break;
		
		case '[object Boolean]':
			p = dom.create(!!it ? 'true' : 'false', null, parent);
			break;
		
		case '[object Null]':
			dom.create('string', { nodeValue: '' }, parent);
			break;
			
		case '[object String]':
			dom.create('string', { nodeValue: it }, parent);
			break;
	}
}

function walkDict(obj, node) {
	var key, next;
	
	while (node) {
		if (node.nodeType == xml.ELEMENT_NODE && node.tagName == 'key') {
			key = (node.firstChild && node.firstChild.data || '').trim();
			
			next = node.nextSibling;
			while (next && next.nodeType != xml.ELEMENT_NODE) {
				next = next.nextSibling;
			}
			
			if (next) {
				if (next.tagName == 'true') {
					obj[key] = true;
					node = next;
				} else if (next.tagName == 'false') {
					obj[key] = false;
					node = next;
				} else if (next.tagName == 'string') {
					obj[key] = '' + (next.firstChild && next.firstChild.data || '').trim(); // cast all values as strings
					node = next;
				} else if (next.tagName == 'integer') {
					obj[key] = parseInt(next.firstChild && next.firstChild.data) || 0;
					node = next;
				} else if (next.tagName == 'real') {
					obj[key] = parseFloat(next.firstChild && next.firstChild.data) || 0;
					node = next;
				} else if (next.tagName == 'date') {
					var d = (next.firstChild && next.firstChild.data || '').trim();
					obj[key] = d ? new Date(d) : null; // note: toXml() can't convert a null date back to a <date> tag
					node = next;
				} else if (next.tagName == 'array') {
					walkArray(obj[key] = [], next.firstChild);
					node = next;
				} else if (next.tagName == 'dict') {
					walkDict(obj[key] = {}, next.firstChild);
				}
			}
		}
		node = node.nextSibling;
	}
}

function walkArray(arr, node) {
	while (node) {
		if (node.nodeType == xml.ELEMENT_NODE) {
			switch (node.tagName) {
				case 'string':
					arr.push('' + (node.firstChild && node.firstChild.data || '').trim());
					break;
				
				case 'integer':
					arr.push(parseInt(node.firstChild && node.firstChild.data) || 0);
					break;
				
				case 'array':
					var a = [];
					walkArray(a, node.firstChild);
					arr.push(a);
					break;
				
				case 'date':
					var d = (node.firstChild && node.firstChild.data || '').trim();
					arr.push(d ? new Date(d) : null);
					break;
				
				case 'dict':
					var obj = {};
					walkDict(obj, node.firstChild);
					arr.push(obj);
					break;
				
				case 'data':
					arr.push((node.firstChild && node.firstChild.data || '').replace(/\s*/g, ''));
			}
		}
		node = node.nextSibling;
	}
}

function toJS(obj, doc) {
	var node = doc.firstChild;
	
	// the first child should be a <dict> element
	while (node) {
		if (node.nodeType == xml.ELEMENT_NODE && node.tagName == 'dict') {
			node = node.firstChild;
			break;
		}
		node = node.nextSibling;
	}
	
	node && walkDict(obj, node);
}

function plist(filename) {
	Object.defineProperty(this, 'load', {
		value: function (file) {
			if (!afs.exists(file)) {
				throw new Error('plist file does not exist');
			}
			toJS(this, (new DOMParser().parseFromString(fs.readFileSync(file).toString(), 'text/xml')).documentElement);
			return this;
		}
	});
	
	Object.defineProperty(this, 'parse', {
		value: function (str) {
			toJS(this, (new DOMParser().parseFromString(str, 'text/xml')).documentElement);
			return this;
		}
	});
	
	Object.defineProperty(this, 'toXml', {
		value: function (indent) {
			var dom = new DOMParser().parseFromString('<plist version="1.0"/>');
			
			dom.create = function (tag, attrs, parent, callback) {
				var node = dom.createElement(tag),
					i = indent || 0,
					p = parent;
				
				attrs && Object.keys(attrs).forEach(function (attr) {
					if (attr == 'nodeValue') {
						node.appendChild(dom.createTextNode(''+attrs[attr]));
					} else {
						attrs[attr] != void 0 && node.setAttribute(attr, ''+attrs[attr]);
					}
				});
				
				if (p) {
					while (p.parentNode) {
						i++;
						p = p.parentNode;
					}
					parent.appendChild(dom.createTextNode('\r\n' + new Array(i).join('\t')));
				}
				
				parent && parent.appendChild(node);
				if (callback) {
					callback(node);
					node.appendChild(dom.createTextNode('\r\n' + new Array(i).join('\t')));
				}
				return node;
			};
			
			toXml(dom, dom.documentElement, this, indent);
			
			dom.documentElement.appendChild(dom.createTextNode('\r\n'));
			
			return dom.documentElement;
		}
	});
	
	Object.defineProperty(this, 'type', {
		value: function (type, value) {
			return new PlistType(type, value);
		}
	});
	
	Object.defineProperty(this, 'toString', {
		value: function (fmt) {
			if (fmt == 'xml') {
				return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' + this.toXml().toString();
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
				wrench.mkdirSyncRecursive(path.dirname(file));
				fs.writeFileSync(file, this.toString('xml'));
			}
			return this;
		}
	});
	
	filename && this.load(filename);
}

module.exports = plist;
