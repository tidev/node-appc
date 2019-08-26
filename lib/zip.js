/**
 * Enhancements to adm-zip.
 *
 * @module xml
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const afs = require('./fs'),
	AdmZip = require('adm-zip');

/**
 * Extracts all files and applies the correct file permissions.
 * @param {String} file - The file to extract
 * @param {String} dest - The destination to extract the files to
 * @param {Object} opts - Extract options
 * @param {Function} [opts.visitor] - A function to call when visiting each file being extracted
 * @param {Boolean} [opts.overwrite=true] - If true, overwrites files on extraction
 * @param {Number} [opts.defaultPerm=0o644] - The default file permissions; should be in octet format
 * @param {Function} finished - A function to call when done extracting all files
 */
exports.unzip = function unzip(file, dest, opts, finished) {
	try {
		const zip = new AdmZip(file),
			zipEntries = zip.getEntries(),
			len = zipEntries.length,
			Utils = require('adm-zip/util'),
			visitor = opts && opts.visitor || function () {},
			overwrite = opts && Object.prototype.hasOwnProperty.call(opts, 'overwrite') ? !!overwrite : true,
			defaultPerm = opts && opts.defaultPerm || 0o644;
		let i = 0;

		// we need to do this self-calling setTimeout() loop otherwise
		// the progress bar is never allowed to render
		(function extractFile() {
			if (i < len) {
				try {
					const entry = zipEntries[i];

					if (visitor(entry, i, len) !== false) {
						if (entry.isDirectory) {
							Utils.makeDir(afs.resolvePath(dest, entry.entryName.toString()));
						} else {
							const content = entry.getData();
							if (!content) {
								// FIXME: This is clearly wrong, but not sure if downstream depends on this behavior!
								throw Utils.Errors.CANT_EXTRACT_FILE + '2'; // eslint-disable-line no-throw-literal
							}
							Utils.writeFileTo(
								afs.resolvePath(dest, entry.entryName.toString()),
								content,
								overwrite,
								(entry.header.attr && (entry.header.attr >>> 16) || defaultPerm) & 0o777
							);
						}
					}

					i++;
					setTimeout(extractFile, 0);
				} catch (ex) {
					finished(ex, i, len);
				}
			} else {
				// done!
				finished(null, i, len);
			}
		}());
	} catch (ex) {
		finished(ex);
	}
};
