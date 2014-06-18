/**
 * @fileoverview easyTemplate.js
 *
 * @method compile //编译出模板函数
 * @param {string} s //模板字符串
 * @return {Function} //可运行的模板函数
 * @param {Object} d //模板数据
 * @return {string} //拼接好的HTML字符串
 *
 * @method render //直接渲染模板
 * @param {string} s //模板字符串
 * @param {Object} d //模板数据
 * @return {string} //拼接好的HTML字符串
 *
 * @author dh20156
 * change   baokun@staff.sina.com.cn
 * @date: 2013-12-25
 *
 * {#et tname dataname} //模板开始标签，tname为此模板的名称，dataname为此模板中用到的数据名称
 * {#if (condition)}
 * {#elseif (condition)}
 * {#else}
 * {/#if}
 * ${x?a:b} //三元表达式，最后不能加分号"；" 注意：在所有的 {} 中都不能出现分号！
 * {#list List as list} //遍历一个数组对象
 * ${list_index} //在此次遍历中的当前索引
 * ${list.xxx} //取值
 * {/#list} //结束遍历
 * {/#et} //模板结束标签
 *
 *
 * @example：
 * var x = easyTemplate.render(sTemplate, oData);
 * 或者当一个模板不变，数据经常变动时可以这样使用：
 * //先将模板解析好以备用
 * var tp = easyTemplate.compile(sTemplate);
 * //在需要用新的数据渲染该模板时调用：
 * var shtml = tp(oData);
 */

(function(undefined) {
	"use strict";
	var global;
	var easyTemplate = {};
	var WEIBO_MULTI_TPL_ENGINE_INCLUDE_ID = 'Weibo_Multi_Template_Engine_Include_id';

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = easyTemplate;
	} else {
		global = (function() {
			return this || (0, eval)('this');
		}());
		global.easyTemplate = easyTemplate;
	}
	easyTemplate._cacheTplStr = undefined;
	easyTemplate._cacheTplData = undefined;
	easyTemplate.compile = function(s, z, dc) {
		if (!s) {
			return '';
		}
		if (s !== easyTemplate._cacheTplStr) {
			easyTemplate._cacheTplStr = s;
			easyTemplate.aStatement = easyTemplate.parsing(easyTemplate.separate(s), z, dc);
		}
		var aST = easyTemplate.aStatement;
		return (new Function(aST[0], aST[1]));
	};

	easyTemplate.render = function(s, d, z, dc) {
		if (d) {
			easyTemplate._cacheTplData = d;
		}
		return easyTemplate.compile(s, z, dc)(easyTemplate._cacheTplData);
	};

	easyTemplate.separate = function(s) {
		var r = /\\'/g;
		var sRet = s.replace(/(\{(\/?)#(.*?(?:\(.*?\))*)\})|(')|([\r\n\t])|(\$\{([^\}]*?)\})/g, function(a, b, c, d, e, f, g, h) {
			if (b) {
				return '{|}' + (c ? '-' : '+') + d + '{|}';
			}
			if (e) {
				return '\\\'';
			}
			if (f) {
				return '';
			}
			if (g) {
				return '\'+(' + h.replace(r, '\'') + ')+\'';
			}
		});
		return sRet;
	};
	easyTemplate.parsing = function(s, z, dc) {
		var mName, vName, sTmp, aTmp, sFL, sEl, aList, aStm = ['var aRet = [];'];
		if (dc) {
			s = s.replace(/<!--[\s\S]*?-->/g, '');
		}
		aList = s.split(/\{\|\}/);
		var r = /\s/;
		
		while (aList.length) {
			sTmp = aList.shift();
			if (!sTmp) {
				continue;
			}
			if (z) {
				sTmp = sTmp.replace(/[\s\t]+/g, ' ');
				sTmp = sTmp.replace(/([\s\t\n\r]+)?(<)/g, '$2').replace(/(>)([\s\t\n\r]+)/g, '$1');
			}
			sFL = sTmp.charAt(0);
			if (sFL !== '+' && sFL !== '-') {
				sTmp = '\'' + sTmp + '\'';
				aStm.push('aRet.push(' + sTmp + ');');
				continue;
			}
			aTmp = sTmp.split(r);
			switch (aTmp[0]) {
				case '+et':
					mName = aTmp[1];
					vName = aTmp[2];
					aStm.push('if (!' + vName + '|| typeof ' + vName + '!= "object" ) return "";');
					break;
				case '-et':
					break;
				case '+if':
					aTmp.splice(0, 1);
					aStm.push('if' + aTmp.join(' ') + '{');
					break;
				case '+elseif':
					aTmp.splice(0, 1);
					aStm.push('}else if' + aTmp.join(' ') + '{');
					break;
				case '-if':
					aStm.push('}');
					break;
				case '+else':
					aStm.push('}else{');
					break;
				case '+list':
					aStm.push('if(' + aTmp[1] + ' && ' + aTmp[1] + '.constructor === Array){with({i:0,l:' + aTmp[1] + '.length,' + aTmp[3] + '_index:0,' + aTmp[3] + ':null}){for(i=l;i--;){' + aTmp[3] + '_index=(l-i-1);' + aTmp[3] + '=' + aTmp[1] + '[' + aTmp[3] + '_index];');
					break;
				case '-list':
					aStm.push('}}}');
					break;
				case '+include':
					var incTmpStr = "aRet.push('" + WEIBO_MULTI_TPL_ENGINE_INCLUDE_ID + ':' + aTmp[1].replace(/['"]/g, '');
					var len = aTmp.length;
					if (len > 2) {
						for (var i = 2; i < len; ++i) {
							incTmpStr += ':' + aTmp[i];
						}
					} else {
						incTmpStr += ':' + vName;
					}
					incTmpStr += "');";
					aStm.push(incTmpStr);
					break;
				default:
					break;
			}
		}
		aStm.push('return aRet.join("");');
		return [vName, aStm.join('')];
	};

	return easyTemplate;

}());