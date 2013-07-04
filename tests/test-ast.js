var appc = require('../index'),
	fs = require('fs'),
	UglifyJS = require('uglify-js');

describe('ast', function () {
	it('namespace exists', function () {
		appc.should.have.property('ast');
		appc.ast.should.be.a('object');
	});

	describe('#getType()', function () {
		it('should discover the ast node types', function () {
			var ast = UglifyJS.parse(fs.readFileSync(__filename).toString(), { filename: __filename });
			appc.ast.getType(ast).should.eql([
				'AST_Node',
				'AST_Statement',
				'AST_Block',
				'AST_Scope',
				'AST_Toplevel'
			]);
		});
	});
});