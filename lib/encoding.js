exports.decodeOctalUTF8 = function (input) {
	var result = '',
		i = 0,
		l = input.length,
		c, octByte;
	
	for (; i < l; i++) {
		c = input.charAt(i);
		if (c == '\\') {
			octByte = input.substring(i + 1, i + 4);
			try {
				result += String.fromCharCode(parseInt(octByte, 8));
				i += 3;
			} catch (e) {
				result += '\\';
				input = octByte + input;
			}
		} else {
			result += c;
		}
	}
	
	return decodeURIComponent(escape(result));
};