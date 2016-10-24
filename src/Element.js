"use strict";

var ArrayElements = require('./ArrayElements');
var ArrayFormatter = require('./ArrayFormatter');
var ObjectFormatter = require('./ObjectFormatter');
var PropertyList = require('./PropertyList');
var PubSub = require('pubsub-js');
var React = require('react');
var TokenName = require('./TokenName');

var cx = require('./cx');
var isArray = require('./isArray');

/* For debugging
function log(f) {
  return function(a, b) {
    var result = f.call(this, a,b);
    console.log(a.name || a.value && a.value.type, 'Updates', result);
    return result;
  };
}
*/

var Element = React.createClass({
    propTypes: {
        name: React.PropTypes.string,
        value: React.PropTypes.any,
        deepOpen: React.PropTypes.bool,
        focusPath: React.PropTypes.array,
        level: React.PropTypes.number,
    },

    getInitialState: function() {
        // Some elements should be open by default
        var open =
            this.props.level === 0 ||
            this.props.deepOpen ||
            this.props.name === 'body' ||
            this.props.name === 'elements' || // array literals
            this.props.name === 'declarations'; // variable declarations

        return {
            open: open,
            deepOpen: this.props.deepOpen
        };
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        // There are two reasons why an AST could be rerendered
        //
        // 1. The node was clicked and it has to either expand or collapse
        // 2. The code was edited and it lies "in the path" of that edit.
        var thisValue = this.props.value;
        var nextValue = nextProps.value;
        var thisName = this.props.name;
        var nextName = nextProps.name;

        // In both cases there is no need to rerender the node if it is a leaf,
        // i.e. a primitive value, and has the same value and name
        if (thisValue == null || typeof thisValue !== 'object') {
            return thisValue !== nextValue || thisName !== nextName;
        }

        // 1. Node was clicked
        // Either the node itself was clicked or one of its ancestors with shift
        // We always updated when deepOpen is in the next state, since we don't know
        // whether
        var toggleChange = this.state.open !== nextState.open || nextState.deepOpen;
        if (toggleChange) {
            return true;
        }

        // 2. Code was edited. We have to rerender a node if the cursor was or
        // is "in" it.
        if (nextProps.focusPath.indexOf(nextValue) > -1) {
            return true;
        }

        // Possible change of focus
        if (nextProps.focusPath.indexOf(nextValue) > -1 !==
            this.props.focusPath.indexOf(thisValue) > -1) {
            return true;
        }

        // The above two tests don't always capture new nodes, because the cursor
        // is just after the new node, i.e. the new node is not in the focus path
        if (thisName !== nextName ||
            Boolean(thisValue) !== Boolean(nextValue) ||
            (thisValue && thisValue.type !== nextValue.type)) {
            return true;
        }

        // TODO: find out why the many checks aren’t updating properly
        return true;
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState({
            open: nextProps.deepOpen || this.state.open,
            deepOpen: nextProps.deepOpen,
        });
    },

    _toggleClick: function(event) {
        if('error' in this.props.value) {
          PubSub.publish('MOVECURSOR', this.props.value.position);
        }
        this.setState({
            open: event.shiftKey || !this.state.open,
            deepOpen: event.shiftKey,
        });
    },

    _onMouseOver: function(e) {
        e.stopPropagation();
        PubSub.publish('HIGHLIGHT', this.props.value);
    },

    _onMouseLeave: function() {
        PubSub.publish('CLEAR_HIGHLIGHT', this.props.value);
    },

    _isFocused: function(level, path, value, open) {
        return level !== 0 &&
            path.indexOf(value) > -1 &&
            (!open || path[path.length - 1] === value);
    },
    componentDidMount: function() {
        var _this = this;
        //wait for a paint to do scrolly stuff
        window.requestAnimationFrame(function() {
            var node = _this.getDOMNode();
            if (node !== undefined) {
                // scroll to position of node
                if (_this.props.focusError) {
                    if (_this.props.value == _this.props.focusError || _this.props.name == "Errors" || _this.props.name == "error") {
                        var el = node;
                        if (!el.classList.contains('focused')) {
                            while ((el = el.parentElement) && !el.classList.contains('focused'));
                        }
                        if (el) {
                          var container = document.getElementById('bem');
                          container.scrollTop = el.offsetTop;
                        }
                    }
                }
            }
        });
    },

    render: function() {
        var value = this.props.value;
        var value_output = null;
        var content = null;
        var prefix = null;
        var suffix = null;
        var showToggler = false;
        var isType = value && value.type;
        var enableHighlight = isType && value.type !== 'Program';
        var focusPath = this.props.focusPath;
        var open = this.state.open;
        var forceopen = false;
        var focused = this._isFocused(this.props.level, focusPath, value, open);

        // focus on the error - close if you've got nothing to do with errors.
        if (this.props.focusError) {
            open = false;
            if (this.props.value == this.props.focusError || this.props.name == "Errors") {
                forceopen = true;
                open = true;
                enableHighlight = true;
            }
            if (this.props.name == "Errors") {
              focused = false;
            }
        }

        if (isArray(value)) {
            if (value.length > 0 && open) {
                prefix = "[";
                suffix = "]";
                content = <
                    ArrayElements
                focusPath = {
                    focusPath
                }
                array = {
                    value
                }
                deepOpen = {
                    this.state.deepOpen || forceopen
                }
                focusError = {
                    this.props.focusError
                }
                />;
            } else {
                value_output = <
                    ArrayFormatter
                array = {
                    value
                }
                onClick = {
                    this._toggleClick
                }
                />;
            }
            showToggler = value.length > 0;
        } else if (value && typeof value === "object") {
            if (open) {
                if (isType) {
                    value_output = <
                        TokenName
                    onClick = {
                        this._toggleClick
                    }
                    object = {
                        value
                    }
                    />;
                }
                prefix = ' {';
                suffix = '}';
                content = <
                    PropertyList
                focusPath = {
                    focusPath
                }
                object = {
                    value
                }
                deepOpen = {
                    this.state.deepOpen || forceopen
                }
                focusError = {
                    this.props.focusError
                }
                />;
            } else {
                value_output = <
                    ObjectFormatter
                onClick = {
                    this._toggleClick
                }
                object = {
                    value
                }
                focusError = {
                    this.props.focusError
                }
                />;
            }
            showToggler = Object.keys(value).length > 0;
        } else {
            value_output = <
                span className = "s" > {
                    typeof value === 'undefined' ? 'undefined' : JSON.stringify(value)
                } <
                /span>;
            showToggler = false;
        }

        var name = this.props.name ?
            <
            span
        className = "key"
        onClick = {
                showToggler ? this._toggleClick : null
            } >
            <
            span className = "name nb" > {
                this.props.name
            } < /span> <
        span className = "p" >: < /span> < /
        span >:
            null;

        var classNames = cx({
            entry: true,
            focused: focused,
            toggable: showToggler,
            open: open
        });

        return ( <
            li ref = "container"
            className = {
                classNames
            }
            onMouseOver = {
                enableHighlight ? this._onMouseOver : null
            }
            onMouseLeave = {
                enableHighlight ? this._onMouseLeave : null
            } > {
                name
            } <
            span className = "value" > {
                value_output
            } < /span> {
            prefix ? < span className = "prefix p" > {
                prefix
            } < /span> : null} {
            content
        } {
            suffix ? < div className = "suffix p" > {
                suffix
            } < /div> : null} < /
            li >
        );
    }
});

module.exports = Element;
