"use strict";
/**
 * Block Element Modifier validator
 * Torleif West 2017
 *
 */


var fs = require('fs');
var css = require('css');

var bem = {
    bemrules: {
        rule0: 'BEM selectors use class name selectors only',
        rule1: 'BEM selectors are independent of elements',
        rule2: 'BEM Block names may consist of Latin letters, digits, and dashes',
        rule3: 'Modifier of a modifier is not allowed',
        rule4: 'BEM block structure should be flattened',
        rule5: 'BEM selectors only allow elements based on block-level modifiers to have multiple rules'
    },
    errors: new Array(),
    blocks: {},
    adderror: function(rule, violation, error_str, example) {
        var cloneerror = JSON.parse(JSON.stringify(rule));
        // what rule was violated
        cloneerror['violation'] = violation;
        // what issue was found
        cloneerror['error'] = error_str;
        // an example of how to fix it
        cloneerror['example'] = example;

        this.errors.push(cloneerror);
    },
    isrule: function(rule) {
        return rule.type == 'rule';
    },
    ismedia: function(rule) {
        return rule.type == 'media';
    },
    checkselector: function(rule, selector) {
        if (/^\#(.+)/g.test(selector)) {
            this.adderror(rule, this.bemrules.rule0, 'ID found', 'Use .block-name, instead of ' + selector);
            return false;
        }
        if (/\[.+\=.+\]/g.test(selector)) {
            this.adderror(rule, this.bemrules.rule0, 'tag name found', 'Use .block-name, instead of ' + selector);
            return false;
        }
        if (/\#(.+)/g.test(selector)) {
            this.adderror(rule, this.bemrules.rule0, 'ID found with dependant element', 'Use .block name instead of ' + selector);
            return false;
        }
        if (/(.+)\.(.+)/g.test(selector)) {
            this.adderror(rule, this.bemrules.rule1, 'class found with dependant element', 'Remove the prefix of the selector - e.g. change div.block to .block');
            return false;
        }
        if (selector.split('--').length > 2) {
            this.adderror(rule, this.bemrules.rule3, 'Two modifiers found on same rule', 'Remove the least prominent modifier selector - e.g. rename .block--mod1--mod2 to .block--mod2');
            return false;
        }
        if (selector.split('__').length > 2) {
            this.adderror(rule, this.bemrules.rule4, 'Two elements found on same rule', 'Remove the least prominent element selector - e.g. rename .block__mod1__mod2 to .block__mod2');
            return false;
        }
        // the order of this rule is important - it allows for pseudo-elements
        // which are a gray area for the BEM methodology e.g. .table-zerbra tr:nth-child(2n+1)
        if (/[_\-A-Za-z0-9]*\:[_\-A-Za-z0-9]*/g.test(selector)) {
            return true;
        }
        if (!(/^\.(.+)/g.test(selector))) {
            this.adderror(rule, this.bemrules.rule0, 'No class found', 'Create a class name for this block e.g. .navigation');
            return false;
        }
        if (/[^_\-A-Za-z0-9.]+/g.test(selector)) {
            this.adderror(rule, this.bemrules.rule2, 'Non alphanumeric character found', 'Remove non alphanumeric characters');
            return false;
        }

        // valid selector
        return true;
    },
    // add a block (and any elements or modifyers if found)
    addblock: function(myname, rule) {
        var mytype = 'block';
        var orginalname = myname;
        if (myname.indexOf('__') != -1) {
            var splitmodifiername = myname.split('__', 2);
            myname = splitmodifiername[0];
            mytype = 'modifier';
        }
        if (myname.indexOf('--') != -1) {
            var splitelementname = myname.split('--', 2);
            myname = splitelementname[0];
            mytype = 'element';
        }
        if (!(myname in this.blocks)) {
            this.blocks[myname] = {
                rule: orginalname == myname ? new Array(rule) : new Array(),
                elements: new Array(),
                modifiers: new Array()
            };
        } else {
            // only add the orginal names to the rules
            if (orginalname == myname) {
                this.blocks[myname].rule.push(rule);
            }
        }
        if (mytype == 'modifier') {
            this.blocks[myname].elements.push(rule);
        }
        if (mytype == 'element') {
            this.blocks[myname].modifiers.push(rule);
        }

    },
    // loop through multple selectos
    checkselectors: function(rule, selectors) {
        var multipleselectors = selectors.split(' ');

        // multiple rules e.g. .rule1 .rule2 {color:red;}
        if (Array.isArray(multipleselectors) && multipleselectors.length > 1) {
            // only elements based on a block-level modifiers are valid
            // todo: find out if multiple block level modifiers are valid?
            var modifier = multipleselectors[0].split('--');
            var myelement = multipleselectors[1].split('__');

            if (modifier.length != 2 || myelement.length != 2) {
                // check if it's not a psudo selector
                if (!(/[_\-A-Za-z0-9]*\:[_\-A-Za-z0-9]*/g.test(multipleselectors[1]))) {
                    var errstr = 'Found a selector more than two levels deep, or an invalid "element element" selector';
                    this.adderror(rule, this.bemrules.rule5, errstr, 'Change selector to element with child modifier - e.g. .block__elm .block--mod');
                    return;
                }
            }
            for (var ss = 0; ss < multipleselectors.length; ss++) {
                if (this.checkselector(rule, multipleselectors[ss])) {
                    this.addblock(multipleselectors[ss], rule);
                }
            }

        } else {
            if (this.checkselector(rule, selectors)) {
                this.addblock(selectors, rule);
            }
        }
    },
    parse: function(csstext, options) {
        this.blocks = {};
        this.errors = new Array();

        var obj = css.parse(csstext, {
            source: 'style.css',
            silent: false
        });

        // is this object a stylesheet?
        if (obj.stylesheet && obj.stylesheet.rules) {
            var rules = obj.stylesheet.rules
            for (var i = 0; i < rules.length; i++) {
                var currentrule = rules[i];

                // check the rules in the media section
                if (this.ismedia(currentrule)) {
                    for (var mr = 0; mr < currentrule.rules.length; mr++) {
                        var mediarule = currentrule.rules[mr];
                        if (!this.isrule(mediarule)) {
                            continue;
                        }
                        for (var mrs = 0; mrs < mediarule.selectors.length; mrs++) {
                            this.checkselectors(mediarule, mediarule.selectors[mrs]);
                        }
                    }
                }
                if (!this.isrule(currentrule)) {
                    continue;
                }

                for (var s = 0; s < currentrule.selectors.length; s++) {
                    this.checkselectors(currentrule, currentrule.selectors[s]);
                }
            }
        }
        
        return {
            BEM: this.blocks,
            Errors: this.errors
        };
    },
    bemValidationMessage: function() {
        return this.errors.length == 0 ? null : this.errors.length + " BEM validation issue(s) found ";
    }
}

module.exports = bem;
