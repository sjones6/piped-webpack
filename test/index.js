const expect = require('chai').expect;
const File = require('vinyl');
const pipedWebpack = require('../');

const noop = function(){};

function testFile(file){
	let expectedResult;

	if(file.basename === 'entry.js'){
		expectedResult = true;
	}else if(file.basename === 'entry2.js'){
		expectedResult = false;
	}else{
		return expect.fail();
	}

	let output = eval(file.contents.toString()); // eslint-disable-line no-eval
	output(function(result){
		expect(result).to.eql(expectedResult);
	});
}

function assertWebpackOutput(stream, cb=noop){
	let foundFiles = [];
	stream.on('data', function(file){
		foundFiles.push(file.path);
		testFile(file);
	});
	stream.on('end', function(){
		foundFiles.sort();
		expect(foundFiles).to.eql(['deep/path/entry.js', 'deep/path/entry2.js']);
		cb();
	});
}

describe('PipedWebpack', function(){
	beforeEach(function(){
		this.config = {
			entry: {
				entry: [__dirname + '/../test_files/entry.js'],
				entry2: [__dirname + '/../test_files/entry2.js'],
			},
			output: {
				filename: 'deep/path/[name].js',
			},
			stats: 'none',
		};
	});

	it('can compile with set entrypoints', function(cb){
		let stream = pipedWebpack(this.config);
		stream.end();
		assertWebpackOutput(stream, cb);
	});

	it('can compile with generated entrypoints', function(cb){
		delete this.config.entry;
		let stream = pipedWebpack(this.config);

		for(let file of [__dirname + '/../test_files/entry.js', __dirname + '/../test_files/entry2.js']){
			stream.write(new File({
				path: file,
			}));
		}

		stream.end();
		assertWebpackOutput(stream, cb);
	});

	it('can compile with additional entrypoints array', function(cb){
		delete this.config.entry;
		this.config.additionalEntries = [__dirname + '/../test_files/additionalEntry.js'];

		let stream = pipedWebpack(this.config);
		stream.write(new File({
			path: __dirname + '/../test_files/entry.js',
		}));
		stream.end();

		stream.on('data', function(file){
			expect(file.path).to.eql('deep/path/entry.js');
			expect(() => {
				eval(file.contents.toString()); // eslint-disable-line no-eval
			}).to.throws();
			cb();
		});
	});

	it('can compile with additional entrypoints function', function(cb){
		delete this.config.entry;
		this.config.additionalEntries = (file) => {
			expect(file).to.be.an.instanceOf(File);
			expect(file.path).to.eql = __dirname + '/../test_files/entry.js';

			return [__dirname + '/../test_files/additionalEntry.js'];
		};

		let stream = pipedWebpack(this.config);
		stream.write(new File({
			path: __dirname + '/../test_files/entry.js',
		}));
		stream.end();

		stream.on('data', function(file){
			expect(file.path).to.eql('deep/path/entry.js');
			expect(() => {
				eval(file.contents.toString()); // eslint-disable-line no-eval
			}).to.throws();
			cb();
		});
	});

	it('can run with empty pipe', function(cb){
		delete this.config.entry;
		let stream = pipedWebpack(this.config);
		stream.end();

		stream.on('data', function(){
			cb(new Error('Found file, but is not expecting'));
		});
		stream.on('end', function(){
			cb();
		});
	});

	it('throw when run with invalid additionalEntries data type', function(cb){
		delete this.config.entry;
		this.config.additionalEntries = __dirname + '/../test_files/additionalEntry.js';

		let stream = pipedWebpack(this.config);
		stream.write(new File({
			path: __dirname + '/../test_files/entry.js',
		}));
		stream.end();

		stream.on('error', function(){
			cb();
		});
	});

	it('can handle error', function(cb){
		this.config.entry = {
			error: [__dirname + '/../test_files/error.js'],
		};
		let stream = pipedWebpack(this.config);
		stream.end();
		stream.on('error', () => {
			cb();
		});
	});

	it('does not throw error in watch mode', function(cb){
		this.config.entry = {
			error: [__dirname + '/../test_files/error.js'],
		};
		this.config.watch = true;

		let stream = pipedWebpack(this.config);
		stream.end();
		stream.on('error', () => {
			cb(new Error('Stream threw error'));
		});
		setTimeout(cb, 10);
	});

	it('can switch plugin instance', function(){
		let self = this;

		class SpyPlugin {
			constructor(config){
				expect(config).to.eql(self.config);
			}

			run(){
				return 'PASS';
			}
		}

		expect(pipedWebpack(this.config, SpyPlugin)).to.eql('PASS');
	});

	it('throw error when given webpack as second argument', function(){
		expect(() => {
			pipedWebpack(this.config, require('webpack'));
		}).to.throw();
	});
});
