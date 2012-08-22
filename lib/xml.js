/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var DOMParser = require('xmldom').DOMParser,
	fs = require('fs'),
	path = require('path'),
	appcfs = require('./fs');

function tiapp(filename) {
	var dom = this._dom = new DOMParser();
	
	if (this.filename = filename) {
		if (!appcfs.exists(filename)) {
			throw new Error('tiapp.xml file does not exist');
		}
		this.parse(fs.readFileSync(filename).toString());
	}
}

tiapp.prototype = {
	get: function (parts, relNode) {
		var n = this.getNode(parts, relNode);
		return n && n.firstChild.data;
	},
	
	getNode: function (parts, relNode, create, createNew) {
		if (!this._doc) {
			throw new Error('tiapp.xml file has not been parsed yet');
		}
		
		if (/^\//.test(parts) || !relNode) {
			relNode = this._doc.documentElement;
		}
		
		parts = parts.replace(/^\//, '').split('/');
		
		if (createNew) {
			var len = parts.length,
				last = parts.pop();
			relNode = parts.length ? this._find(relNode, parts, create) : relNode;
			n = this._create(relNode, [last]);
			relNode.insertBefore(n, relNode.firstChild);
			relNode.insertBefore(this._doc.createTextNode('\n' + Array(len+1).join('\t')), relNode.firstChild);
		} else {
			n = this._find(relNode, parts, create);
		}
		
		return n;
	},
	
	_find: function (node, parts, create) {
		var match = false,
			len = parts.length;
		for (var i = 0; i < node.childNodes.length; i++) {
			if (node.childNodes[i].tagName == parts[0]) {
				match = true;
				parts.shift();
				return parts.length == 0 ? node.childNodes[i] : this._find(node.childNodes[i], parts, create);
			}
		}
		if (!match && create) {
			var n = this._create(node, parts);
			node.insertBefore(n, node.firstChild);
			node.insertBefore(this._doc.createTextNode('\n' + Array(len+1).join('\t')), node.firstChild);
			return n;
		}
	},
	
	_create: function (node, parts) {
		var part = parts.shift(),
			n = this._doc.createElement(part);
		if (parts.length) {
			return this._create(n, parts);
		}
		n.appendChild(this._doc.createTextNode(''));
		return n;
	},
	
	set: function (parts, value, relNode, createNew) {
		if (!this._doc) {
			throw new Error('tiapp.xml file has not been parsed yet');
		}
		
		var node = this.getNode(parts, relNode, true, createNew);
		
		if (Array.isArray(value)) {
			value.forEach(function (v) {
				v.tag && this.set(parts + '/' + v.tag, v, relNode, true);
			}, this);
			var len = Array.isArray(parts) ? parts.length : 1;
			node.appendChild(this._doc.createTextNode('\n' + Array(len+1).join('\t')));
		} else if (Object.prototype.toString.call(value) == '[object Object]') {
			node.firstChild.data = (value.value || '').toString();
			for (var i = 0; i < node.attributes.length; i++) {
				node.removeAttribute(node.attributes[i].nodeName);
			}
			if (value.attrs) {
				Object.keys(value.attrs).forEach(function (a) {
					node.setAttribute(a, (value.attrs[a] || '').toString());
				});
			}
		} else {
			node.firstChild.data = (value || '').toString();
		}
		
		return this;
	},
	
	parse: function (str) {
		return this._doc = this._dom.parseFromString(str, 'text/xml');
	},
	
	serialize: function () {
		if (!this._doc) {
			throw new Error('tiapp.xml file has not been parsed yet');
		}
		
		return '<?xml version="1.0" encoding="UTF-8"?>\n' + this._doc.documentElement.toString();
	},
	
	save: function (filename) {
		if (filename || (filename = this.filename)) {
			var dir = path.dirname(filename);
			appcfs.exists(dir) || wrench.mkdirSyncRecursive(dir);
			fs.writeFileSync(filename, this.serialize());
		}
	}
};

exports.tiapp = tiapp;
