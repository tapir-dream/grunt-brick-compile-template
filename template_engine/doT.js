/**
 * @fileoverview doT.js
 * 2011, Laura Doktorova, https://github.com/olado/doT
 * Licensed under the MIT license.
 *
 * @date 2013-07-25 2013-12-25
 * @author doT
 * change baokun@staff.sina.com.cn
 */

(function(undefined) {
    "use strict";
    var WEIBO_MULTI_TPL_ENGINE_INCLUDE_ID = 'Weibo_Multi_Template_Engine_Include_id';
    var doT = {
        version: '1.0.1',
        templateSettings: {
            evaluate: /\{\{([\s\S]+?(\}?)+)\}\}/g,
            interpolate: /\{\{=([\s\S]+?)\}\}/g,
            encode: /\{\{!([\s\S]+?)\}\}/g,
            use: /\{\{#([\s\S]+?)\}\}/g,
            useParams: /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
            define: /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
            defineParams: /^\s*([\w$]+):([\s\S]+)/,
            conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
            iterate: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
            varname: 'it',
            include: /\{\{include([\s\S]+?)(.+?)\}\}/g,
            strip: true,
            append: true,
            selfcontained: false
        },
        template: undefined, //fn, compile template
        compile: undefined //fn, for express
    }, global;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = doT;
    } else {
        global = (function() {
            return this || (0, eval)('this');
        }());
        global.doT = doT;
    }

    function encodeHTMLSource() {
        var encodeHTMLRules = {
            "&": "&#38;",
            "<": "&#60;",
            ">": "&#62;",
            '"': '&#34;',
            "'": '&#39;',
            "/": '&#47;'
        },
            matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
        return function(str) {
            return str ? str.replace(matchHTML, function(m) {
                return encodeHTMLRules[m] || m;
            }) : str;
        };
    }

    var startend = {
        append: {
            start: "'+(",
            startEncode: "'+encodeHTML(",
            end: ")+'",
            endencode: "||'').toString())+'"
        },
        split: {
            start: "';out+=(",
            startEncode: "';out+=encodeHTML(",
            end: ");out+='",
            endencode: "||'').toString());out+='"
        }
    }, skip = /$^/;

    function resolveDefs(c, block, def) {
        return ((typeof block === 'string') ? block : block.toString())
            .replace(c.define || skip, function(m, code, assign, value) {
                if (code.indexOf('def.') === 0) {
                    code = code.substring(4);
                }
                if (!(code in def)) {
                    if (assign === ':') {
                        if (c.defineParams) value.replace(c.defineParams, function(m, param, v) {
                            def[code] = {
                                arg: param,
                                text: v
                            };
                        });
                        if (!(code in def)) def[code] = value;
                    } else {
                        new Function("def", "def['" + code + "']=" + value)(def);
                    }
                }
                return '';
            })
            .replace(c.use || skip, function(m, code) {
                if (c.useParams) code = code.replace(c.useParams, function(m, s, d, param) {
                    if (def[d] && def[d].arg && param) {
                        var rw = (d + ":" + param).replace(/'|\\/g, '_');
                        def.__exp = def.__exp || {};
                        def.__exp[rw] = def[d].text.replace(new RegExp("(^|[^\\w$])" + def[d].arg + "([^\\w$])", "g"), "$1" + param + "$2");
                        return s + "def.__exp['" + rw + "']";
                    }
                });
                var v = new Function("def", "return " + code)(def);
                return v ? resolveDefs(c, v, def) : v;
            });
    }

    function unescape(code) {
        return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, ' ');
    }

    doT.template = function(tmpl, z, dc, c, def) {
        c = c || doT.templateSettings;
        var cse = c.append ? startend.append : startend.split,
            needhtmlencode, sid = 0,
            indv,
            str = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl;
        if (z) {
          str = str.replace(/[\s\t]+/g, ' ');
          str = str.replace(/([\s\t\r\n]+)?(<)/g, '$2').replace(/(>)([\s\t\r\n]+)/g, '$1');
        }
        if (dc) {
          str = str.replace(/<!--[\s\S]*?-->/g, '');
        }
        str = ("var out='" + (c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g, ' ')
                .replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g, '') : str)
            .replace(/'|\\/g, '\\$&')
            .replace(c.include || skip, function(m, code, str) {
                str = str.replace(/\\'|\\"/g, '');
                var incTmpStr = "';out+='" + WEIBO_MULTI_TPL_ENGINE_INCLUDE_ID;
                str = str.trim().replace(/\s+/g, ' ');
                var arr = str.split(' ');
                var len = arr.length;
                if (len > 1) {
                    for (var i = 0; i < len; ++i) {
                        incTmpStr += ':' + arr[i];
                    }
                } else {
                    incTmpStr += ':' + arr[0] + ':' + c.varname;
                }
                incTmpStr += "'; out+='";
                return incTmpStr;
            })
            .replace(c.interpolate || skip, function(m, code) {
                return cse.start + unescape(code) + cse.end;
            })
            .replace(c.encode || skip, function(m, code) {
                needhtmlencode = true;
                return cse.startEncode + unescape(code) + cse.endencode;
            })
            .replace(c.conditional || skip, function(m, elsecase, code) {
                return elsecase ?
                    (code ? "';}else if(" + unescape(code) + "){out+='" : "';}else{out+='") :
                    (code ? "';if(" + unescape(code) + "){out+='" : "';}out+='");
            })
            .replace(c.iterate || skip, function(m, iterate, vname, iname) {
                if (!iterate) return "';} } out+='";
                sid += 1;
                indv = iname || "i" + sid;
                iterate = unescape(iterate);
                return "';var arr" + sid + "=" + iterate + ";if(arr" + sid + "){var " + vname + "," + indv + "=-1,l" + sid + "=arr" + sid + ".length-1;while(" + indv + "<l" + sid + "){" + vname + "=arr" + sid + "[" + indv + "+=1];out+='";
            })
            .replace(c.evaluate || skip, function(m, code) {
                return "';" + unescape(code) + "out+='";
            }) + "';return out;")
            .replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
            .replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, '')
            .replace(/(\s|;|\}|^|\{)out\+=''\+/g, '$1out+=');

        if (needhtmlencode && c.selfcontained) {
            str = "var encodeHTML = (" + encodeHTMLSource.toString() + "());" + str;
        }
        try {
            return new Function(c.varname, str);
        } catch (e) {
            if (typeof console !== 'undefined') console.log("Could not create a template function: " + str);
            throw e;
        }
    };

    doT.compile = function(tmpl, z, dc, c, def) {
        return doT.template(tmpl, z, dc, c, def);
    };
    doT.render = function(tmpl, data, z, dc, c, def) {
        return doT.template(tmpl, z, dc, c, def)(data);
    };
}());