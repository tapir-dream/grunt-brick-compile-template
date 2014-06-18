var path = require('path');

module.exports = function(grunt) {
	grunt.registerMultiTask('compile-template', 'compile some template for commonjs', function() {

		var options = this.options({
			'templateEngine': {
				'doT': {
					'path': './template_engine/doT.js',
					'setting': {
						'evaluate': /\{\{([\s\S]+?(\}?)+)\}\}/g,
						'interpolate': /\{\{=([\s\S]+?)\}\}/g,
						'encode': /\{\{!([\s\S]+?)\}\}/g,
						'use': /\{\{#([\s\S]+?)\}\}/g,
						'useParams': /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
						'define': /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
						'defineParams': /^\s*([\w$]+):([\s\S]+)/,
						'conditional': /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
						'iterate': /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
						'varname': 'it',
						'include': /\{\{include([\s\S]+?)(.+?)\}\}/g,
						'strip': true,
						'append': true,
						'selfcontained': false
					}
				},
				'easyTemplate': {
					'path': './template_engine/easyTemplate.js'
				},
			},
			'prefix': 'dist/',
			'default': 'easyTemplate',
			'maxIncludeNested': 5
		});

		var defalutEngine = options['default'];
		var emptyFunc = function() {};
		var tplEngine = {};
		var INCLUDE_PATTERN = /(['"])Weibo_Multi_Template_Engine_Include_id\:(.)+?\:(.)+?\1/g;
		var that = this;
		var compressionSpace = options['compressionSpace'];
		var useRequire = options['useRequire'];
		var useSeaJS = options['useSeaJS'];
		var useTplFunc =  options['useTplFunc'];
		var maxIncludeNested = options['maxIncludeNested'];
		var excludeList =  options['exclude'] || false;
		var deleteComment = options['deleteComment'];
		
		var done = this.async();
		var excludeMap = {};
		
		function formatExcludeList() {
			var list = {
				str:[],
				regexp: []
			}
			if (!excludeList) {
				excludeList = list;
				return;
			}
			if (typeof excludeList === 'string') {
				excludeList = [excludeList];
			}
			if (!Array.isArray(excludeList)) {
				grunt.fatal('exclude option need to be Array type.');
			}
			
			var newExcludeList = [];
			excludeList.forEach(function(v, i) {
				if (typeof v !== 'string') return;
				if (!/^\//.test(v)) {
					v = '/' + v;
				} 
				if (v.indexOf('*') != -1) {
					v = new RegExp('^' + v.replace(/([\*])+/g, '[\\w\\\/]+?'));
				}
				newExcludeList.push(v);
			});
			newExcludeList.forEach(function(v) {
				if (typeof v === 'object') {
					list.regexp.push(v);
				}
				if (typeof v === 'string') {
					list.str.push(v);
				}
				
			});
			excludeList = list;
		};
		
		function isExclude(path) {
			if (!excludeList) return false;
			// 以前检测过就直接返回true
			if (excludeMap[path]) return true;
			// 遍历字符串排除表
			for (var i = 0, c = excludeList.str.length; i < c; ++i) {
				var v = excludeList.str[i];
				if (v === path) {
					excludeMap[path] = true;
					break;
				}
			}
			// 如果存在就返回true
			if (excludeMap[path]) return true;
			
			// 遍历正则排除表
			for (var i = 0, c = excludeList.regexp.length; i < c; ++i) {
				var v = excludeList.regexp[i];
				if (v.test(path)) {
					excludeMap[path] = true;
					break;
				}
			}
			// 如果存在就返回 true
			if (excludeMap[path]) return true;
			// 都没有的话返回 false
			return false;
		}
		
		function asyncLoop(opts) {
			var undef = void 0;
			var loop = function(determine, body, currentVal, finished) {
				if (!determine(currentVal)) {
					if (typeof finished === 'function') {
						finished(currentVal);
					}
					return;
				}
				currentVal = body(currentVal);
				if (currentVal === undef) {
					return;
				}
				setImmediate(function() {
					loop(determine, body, currentVal, finished);
				});
			};
			
			if (!opts.determine(opts.initVal)) {
				if (typeof opts.finished === 'function') {
					opts.finished(currentVal);
				}
				return;
			}
			loop(opts.determine, opts.body, opts.initVal, opts.finished);
		}
		
		function initEngine() {
			var keys = Object.keys(options.templateEngine);
			keys.forEach(function(key) {
				tplEngine[key] = require(options.templateEngine[key].path);
			});
		}

		function tplEngineSetting() {
			var tplEngineNames = Object.keys(tplEngine);
			tplEngineNames.forEach(function(tplEngineName) {
				var setting = options.templateEngine[tplEngineName].setting;
				switch (tplEngineName) {
					case 'doT':
						if (!setting && typeof setting != 'object') {
							break;
						}
						var settingKeys = Object.keys(setting);
						settingKeys.forEach(function(settingKey) {
							tplEngine[tplEngineName]['templateSettings'][settingKey] = setting[settingKey];
						});
						break;
				}
			});
		}
		
		function buildCompileCache() {
			var filesBuffer = {};
			that.files.forEach(function(file) {
				file.src.map(function(filePath) {
					var	engineName = (!file.templateEngine) ? defalutEngine : file.templateEngine;
					var engine = tplEngine[engineName];
					if (!engine) {
						grunt.fatal('Template Engine: ' + engineName + ' is not find.');
						return;
					}
					
					var define_path = file.dest;
					var src_tpl = grunt.file.read(filePath);
					try {
						// 虽说可以从complie里拿到拼接好的func字符串，
						// 但是这里还是toString下
						// 组要是为了确保 new Func 时候由于模板格式错误
						// 导致func字符串拼接错误，转为func时引擎能报错提示
						var dist_tpl = engine.compile(src_tpl, compressionSpace, deleteComment).toString().replace(/^function anonymous\(/, 'function (');
						filesBuffer[filePath] = {
							src: filePath,
							dist: define_path,
							file: dist_tpl
						};
					} catch (err) {
						grunt.log.error('error:\nsrc\t%s\nmsg\t%s', filePath, err.message);
						throw err;
					}
				});
			});
			return filesBuffer;
		}
		
		function checkIncludeFlag(curFile, incMap, fileMap, fileObj, includeTable) {
			var incLinkLen = includeTable.length - 1;
			if (incLinkLen > maxIncludeNested) {
				grunt.fatal('file ' + curFile + '  limits to the max include.\nincTalbe:\n' + includeTable.join('->\n'));
				return;
			}
			var sTplCompliedFunc = fileObj.file;
			var filePath = fileObj.src;
			var incRuleList = sTplCompliedFunc.match(INCLUDE_PATTERN);

			if (!incRuleList || incRuleList.length == 0) {
				return;
			}
			var _i = 0;
			incRuleList.forEach(function(incRule) {
				incRule = incRule.replace(/['"]+|\\['"]/g, '');
				var arr = incRule.split(':');
				if (arr.length < 2) {
					return;
				}
				// 拆出模板inc标记中的数据结构
				var args = {
					path: checkIncPath(arr[1]),
					varname: arr[2]
				};
				var incPath = args.path;
				var incfileObj = fileMap[incPath];
				
				var inExclude = isExclude(incPath);
				if (inExclude) {
					fileMap[incPath] = {
						file : '',
						dist : incPath
					};
					incfileObj = fileMap[incPath];
				}
				// 检测inc路径错误情况
				if (!inExclude && !incfileObj) {
					grunt.fatal('include ' + incPath + ' is not find.');
					return;
				}
				
				// 检测循环引用情况
				if (includeTable.indexOf(incPath) != -1) {
					grunt.fatal('loop include ' + incPath + ' in ' + filePath + ' template file.\nloop path:\n ' + includeTable.join(' ->\n ') + ' ->\n ' + incPath);
					return;
				}
				includeTable.push(incPath);
				if (!inExclude) {
					// 递归检测inc标记
					// 直至把所有inc文件加入到incTable结构中
					checkIncludeFlag(curFile, incMap, fileMap, incfileObj, includeTable);
				}
				//console.log(curFile, includeTable, '=====')
				// 如果 incMap 结构中存在指定文件
				// 那么在它存在多个不同inc引用，将每个incTalbe链接关系push给它
				// 否则它将是现在唯一的新inc
				// 把现有得出的 incTalbe链接关系放入新数组内

				if (incMap[curFile]) {
					incMap[curFile].push(includeTable);
				} else {
					incMap[curFile] = [includeTable];
				}
				includeTable = [curFile];
			});
		}

		function checkIncPath(filePath) {
			if (isExclude(filePath)) return filePath;
			if (!/^src\//.test(filePath)) {
				return 'src/' + (filePath.indexOf('/') === 0 ? filePath.substr(1, filePath.length) : filePath);
			}
			return filePath;
		}
		
		function processIncludeTalbe(fileMap, incMap) {
			var files = Object.keys(incMap);
			files.forEach(function(file) {
				var skip = false;
				var includeTableList = incMap[file];
				includeTableList.forEach(function(includeTable) {
					var len = includeTable.length;
					for (var i = len - 2; i > -1; --i) {
						if (skip) {
							break;
						}
						skip = replaceIncludeFlag(file, incMap, fileMap, includeTable[i], includeTable[i + 1]);
					}
				});
				// 如果有跳过，则说明此inc还依赖其他inc，不处理
				// 否则这条inc链均处理完毕，从incMap中干掉它
				if (!skip) {
					delete incMap[file];
				}
			});
			//console.log(incMap, '======')
		}
		
		function replaceIncludeFlag(file, incMap, fileMap, srcPath, incPath) {
			var srcFile = fileMap[srcPath].file;
			var distPath = fileMap[incPath].dist;
			var prefix = options.prefix;
			if (distPath.indexOf(prefix) === 0) {
				distPath = distPath.replace(prefix, '');
			}
			if (isExclude(incPath)) {
				distPath = distPath.replace(/\.[\w]+$/, '');
			} else {
				distPath = distPath.replace(/\.js$/, '');
			}
			
			distPath = distPath.replace(/^\//, '');
			
			var incRuleList = srcFile.match(INCLUDE_PATTERN);
			if (!incRuleList || incRuleList.length == 0) {
				return;
			}
			// 如果替换中发现inc还依赖其他inc，则跳过不处理
			if (incMap[incPath] && file != incPath) {
				return true;
			}
			
			incRuleList.forEach(function(incRule) {
				incRule = incRule.replace(/['"]+|\\['"]/g, '');
				var arr = incRule.split(':');
				if (arr.length < 2) {
					return;
				}
				var args = {
					path: checkIncPath(arr[1]),
					varname: arr[2]
				};
				// 一个文件内可能有多个inc引用
				// 一次替换过程仅处理传入的inc文件
				// 其它inc路径跳过
				if (incPath != args.path) {
					return;
				}
				
				incRule = incRule.replace(/\\/g, '/').replace(/\./g, '\\.').replace(/\:/g, '\\:').replace(/\//g, '\\/');
				var incRulePattern = new RegExp('([\'"])' + incRule + '\\1', 'g');
				var incTpl;
				if (useRequire) {
					// 为了兼容 pw 坑爹的 require 语法分析……
					incTpl = srcFile.replace(new RegExp('([\'"])' + incRule + '\\1', 'g'), '(function(){var tpl = require("' + distPath + '");return tpl(' + args.varname + ');})()');
					//incTpl = srcFile.replace(incRulePattern, 'require("' + distPath + '")(' + args.varname + ')');
				} else {
					if (!excludeList) {
						grunt.fatal('Has include exclude list, plase set "useRequire" is true in tpl compile options.')
					}
					incTpl = srcFile.replace(incRulePattern, '(' + fileMap[incPath].file + ')(' + args.varname + ')');
				}
				fileMap[srcPath].file = incTpl;
			});
		}
		
		function processInclude(fileMap, callFunc) {
			var keys = Object.keys(fileMap);
			var incMap = {};
			var len = keys.length;
			// each每一个文件，得出所有文件的incMap数据
			// 为了避免递归栈溢出采用异步循环方式
			asyncLoop({
				initVal: 0,
				determine: function(i) {
					return i < len;
				},
				body: function(i) {
					var key = keys[i];
					checkIncludeFlag(key, incMap, fileMap, fileMap[key], [key]);
					return ++i;
				},
				finished: function() {
					while(Object.keys(incMap).length > 0) {
						processIncludeTalbe(fileMap, incMap);
					}
					callFunc(fileMap);
				}
			});
		}
		
		function generate(compileCache) {
			var keys = Object.keys(compileCache);
			var prefixPattern = new RegExp('^' + options.prefix);
			keys.forEach(function(key) {
				var fileObj = compileCache[key];
				var define_path = fileObj.dist.replace(/\.\w+$/, '').replace(prefixPattern, '');
				var start_tpl;
				var tplFuncString = '';
				if (useTplFunc) {
					tplFuncString = 'var tplFunc = require("' + useTplFunc  + '");';
				}
				if (useSeaJS) {
					start_tpl = 'define(function(require, exports) {\n' + tplFuncString + '\nreturn ';
				} else {
					var start_tpl = 'define("' + define_path + '", function(require, exports, module) {\n' + tplFuncString + '\nmodule.exports = ';
				}
				var end_tpl = '\n});';
				var value = start_tpl + fileObj.file + end_tpl;
				if (!isExclude(fileObj.dist)) {
					grunt.file.write(fileObj.dist, value);
				}
			});
		}
		
		function init() {
			formatExcludeList();
			initEngine();
			tplEngineSetting();
			var compileCache = buildCompileCache();
			processInclude(compileCache, function(compileFiles) {
				generate(compileFiles);
				done();
			});
		}
		
		init();
		
	});
};