"use strict";

var isArray = require('./isArray');
var indexFromPos = require('./adapters/css').indexFromPos;

function isInRange(range, pos) {
    return pos >= range[0] && pos <= range[1];
}

function getFocusBemPath(node, pos, path, doc) {
    if (node.range) {
        if (isInRange(node.range, pos)) {
            path.push(node);
        } else {
            return [];
        }
    } else if (node.position) {
        if (
            isInRange([
                indexFromPos(node.position.start, doc),
                indexFromPos(node.position.end, doc)
            ], pos)
        ) {
            path.push(node);
        } else {
            return [];
        }
    } else if (isArray(node) && node.length > 0) {
        if (!node[0].position) return [];
        var inRange = isInRange([indexFromPos(node[0].position.start, doc), indexFromPos(node[node.length - 1].position.end, doc)], pos);

        // check first and last child
        if (inRange) {
            path.push(node);
        } else {
            return [];
        }
    }
    for (var prop in node) {
        if (prop !== 'range' && prop !== 'position' && node[prop] && typeof node[prop] === 'object') {
            var childPath = getFocusBemPath(node[prop], pos, [], doc);
            if (childPath.length > 0) {
                path.push.apply(path, childPath);
                break;
            }
        }
    }
    if ('Errors' in node) {
        for (var properr in node.Errors) {
            if (properr !== 'range' && properr !== 'position' && node.Errors[properr] && typeof node.Errors[properr] === 'object') {
                var childPath = getFocusBemPath(node.Errors[properr], pos, [], doc);
                if (childPath.length > 0) {
                    if (!('Errors' in path)) {
                        path['Errors'] = new Array();
                    }
                    path['Errors'].push.apply(path, childPath);
                    break;
                }
            }
        }
    }
    return path;
}

module.exports = getFocusBemPath;
