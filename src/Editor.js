/*jshint browser:true, newcap:false, expr:true*/
"use strict";

var CodeMirror = require('codemirror');
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/css/css');

var PubSub = require('pubsub-js');
var React = require('react');
var keypress = require('keypress').keypress;

var Editor = React.createClass({

    getDocument: function() {
        return this.codeMirror && this.codeMirror.doc;
    },

    getValue: function() {
        return this.codeMirror && this.codeMirror.getValue();
    },

    componentWillReceiveProps: function(nextProps) {
        if (nextProps.value !== this.codeMirror.getValue()) {
            this.codeMirror.setValue(nextProps.value);
        }
    },

    shouldComponentUpdate: function() {
        return false;
    },

    componentDidMount: function() {
        this._CMHandlers = [];
        this._subscriptions = [];
        this.codeMirror = CodeMirror(
            this.refs.container.getDOMNode(), {
                value: this.props.value,
                lineNumbers: true,
                gutters: ["note-gutter", "CodeMirror-linenumbers", "CodeMirror-lint-markers"],
            }
        );

        if (this.props.onContentChange) {
            this._onContentChange();
        }

        this._bindCMHandler('changes', () => {
            clearTimeout(this._updateTimer);
            this._updateTimer = setTimeout(this._onContentChange, 200);
        });
        this._bindCMHandler('cursorActivity', () => {
            clearTimeout(this._updateTimer);
            this._updateTimer = setTimeout(this._onActivity, 100);
        });

        this._keyListener = new keypress.Listener();
        this._keyListener.simple_combo('meta z', event => {
            if (event.target !== 'TEXTAREA') {
                this.codeMirror.execCommand('undo');
            }
        });

        this._markerRange = null;
        this._mark = null;
        this._markerrors = new Array();

        this._subscriptions.push(
            PubSub.subscribe('CM.HIGHLIGHT', (_, range) => {
                var doc = this.codeMirror.getDoc();
                this._markerRange = range;
                // We only want one mark at a time.
                if (this._mark) this._mark.clear();
                if (typeof range === 'undefined') return;
                for (var mr = 0; mr < this._markerrors.length; mr++) {
                    this._markerrors[mr].className = '';
                }
                if (range[0] && range[1]) {
                    this._mark = this.codeMirror.markText(
                        doc.posFromIndex(range[0]),
                        doc.posFromIndex(range[1]), {
                            className: 'marked'
                        }
                    );
                } else {
                    this._mark = this.codeMirror.markText({
                        line: range.start.line - 1,
                        ch: range.start.column - 1
                    }, {
                        line: range.end.line - 1,
                        ch: range.end.column - 1
                    }, {
                        className: 'marked'
                    });
                }
            }),
            PubSub.subscribe('CM.HIGHLIGHTERRORS', (_, range) => {
                if (typeof range === 'undefined') {return;}
                if (this._mark) {
                    return;
                }

                // remove all old mark texts
                var markedtext = this.codeMirror.getAllMarks();
                for (var mr = 0; mr < markedtext.length; mr++) {
                    markedtext[mr].clear();
                }

                this.codeMirror.clearGutter("CodeMirror-lint-markers");
                this._markerrors = new Array();
                var myeditor = this;
                var markedlines = {};

                for (var me = 0; me < range.Errors.length; me++) {
                    var current_error = range.Errors[me];

                    if(current_error.position.start.line in markedlines) {
                      continue;
                    }
                    markedlines[current_error.position.start.line] = true;
                    this._markerrors.push(this.codeMirror.markText({
                        line: current_error.position.start.line - 1,
                        ch: current_error.position.start.column - 1
                    }, {
                        line: current_error.position.end.line - 1,
                        ch: current_error.position.end.column - 1
                    }, {
                        className: 'marked-error'
                    }));

                    var msg = document.createElement("div");
                    var details = document.createElement("div");
                    msg.setAttribute('data-position', JSON.stringify(current_error.position));
                    msg.setAttribute('data-id', this._markerrors[this._markerrors.length - 1].id);

                    var populhtml = '<dl>';
                    populhtml += '<dt><strong>Violation:</strong></dt><dd>' + current_error.violation + '</dd>';
                    populhtml += '<dt><strong>Error:</strong></dt><dd>' + current_error.error + '</dd>';
                    populhtml += '<dt><strong>Example Fix:</strong></dt><dd>' + current_error.example + '</dd>';
                    populhtml += '<dl>';

                    details.innerHTML = populhtml;
                    details.className = 'CodeMirror-lint-tooltip';
                    details.style.display = "none";
                    msg.className = "CodeMirror-lint-marker-error";
                    msg.appendChild(details);

                    // display the tool tip for fixing this issue
                    msg.addEventListener("mouseenter", function(event) {
                        event.target.firstChild.style.display = "block";
                        event.target.firstChild.style.opacity = "1";
                        if (JSON.parse(event.target.getAttribute('data-position'))) {
                            // you just removed the mark
                            for (var mer = 0; mer < myeditor._markerrors.length; mer++) {
                                var mark_error = myeditor._markerrors[mer];
                                if (mark_error.id == this.getAttribute('data-id')) {
                                    mark_error.clear();
                                }
                            }

                            var mjson = JSON.parse(event.target.getAttribute('data-position'));
                            if (myeditor._mark) myeditor._mark.clear();

                            myeditor._mark = myeditor.codeMirror.markText({
                                line: mjson.start.line - 1,
                                ch: mjson.start.column - 1
                            }, {
                                line: mjson.end.line - 1,
                                ch: mjson.end.column - 1
                            }, {
                                className: 'marked'
                            });
                        }
                    }, false);

                    // remove the tool tip
                    msg.addEventListener("mouseleave", function(event) {
                        event.target.firstChild.style.display = "none";
                        event.target.firstChild.style.opacity = "1";

                        // re add the marked text
                        var mjson = JSON.parse(event.target.getAttribute('data-position'));
                        myeditor._markerrors.push(myeditor.codeMirror.markText({
                            line: mjson.start.line - 1,
                            ch: mjson.start.column - 1
                        }, {
                            line: mjson.end.line - 1,
                            ch: mjson.end.column - 1
                        }, {
                            className: 'marked-error'
                        }));
                        event.target.setAttribute('data-id', myeditor._markerrors[myeditor._markerrors.length - 1].id);

                    }, false);

                    // place the tool tip under the mouse
                    msg.addEventListener("mousemove", function(event) {
                        var tt = event.target.firstChild;
                        if (!tt || !tt.style) return;
                        var mytop = Math.max(0, event.clientY - tt.offsetHeight - 5);
                        if (mytop < 75) {
                            mytop = 75;
                        }
                        tt.style.top = mytop + "px";
                        tt.style.left = (event.clientX + 15) + "px";
                    }, false);


                    // focus the error in the code view
                    msg.addEventListener("click", function(event) {
                      var mjson = JSON.parse(event.target.getAttribute('data-position'));
                      myeditor.codeMirror.setCursor(mjson.start.line-1, mjson.start.column)
                      myeditor.codeMirror.scrollIntoView(null, 2);

                      // open up the error in the AST window
                      var clickfun = function (el) {
                        if(!el) return;
                          var evt;
                          if (document.createEvent) {
                              evt = document.createEvent("MouseEvents");
                              evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                          }
                          (evt) ? el.dispatchEvent(evt) : (el.click && el.click());
                      }
                    }, false);

                    this.codeMirror.setGutterMarker(current_error.position.start.line - 1, "CodeMirror-lint-markers", msg);
                }
            }),

            PubSub.subscribe('CM.CLEAR_HIGHLIGHT', (_, range) => {
                for (var mr = 0; mr < this._markerrors.length; mr++) {
                    this._markerrors[mr].className = 'marked-error';
                }
                if (!range ||
                    (this._markerRange && (
                        range[0] === this._markerRange[0] &&
                        range[1] === this._markerRange[1]
                    ) || (
                        range.start.column - 1 === this._markerRange[0].ch &&
                        range.start.line - 1 === this._markerRange[0].line &&
                        range.end.column - 1 === this._markerRange[1].ch &&
                        range.end.line - 1 === this._markerRange[1].line
                    ))) {
                    this._markerRange = null;
                    if (this._mark) {
                        this._mark.clear();
                        this._mark = null;
                    }
                }
            }),

              PubSub.subscribe('CM.MOVECURSOR', (_, point) => {
                this.codeMirror.setCursor(point.start.line-1, point.start.column);
              }),
            PubSub.subscribe('PANEL_RESIZE', () => {
                if (this.codeMirror) {
                    this.codeMirror.refresh();
                }
            })
        );
    },

    componentWillUnmount: function() {
        this._unbindHandlers();
        this._markerRange = null;
        this._mark = null;
        var container = this.refs.container.getDOMNode();
        container.removeChild(container.children[0]);
        this.codeMirror = null;
    },

    _bindCMHandler: function(event, handler) {
        this._CMHandlers.push(event, handler);
        this.codeMirror.on(event, handler);
    },

    _unbindHandlers: function() {
        var cmHandlers = this._CMHandlers;
        for (var i = 0; i < cmHandlers.length; i += 2) {
            this.codeMirror.off(cmHandlers[i], cmHandlers[i + 1]);
        }
        this._subscriptions.forEach(function(token) {
            PubSub.unsubscribe(token);
        });
    },

    _onContentChange: function() {
        var doc = this.codeMirror.getDoc();
        this.props.onContentChange && this.props.onContentChange({
            value: doc.getValue(),
            cursor: doc.indexFromPos(doc.getCursor())
        });
    },

    _onActivity: function() {
        this.props.onActivity && this.props.onActivity(
            this.codeMirror.getDoc().indexFromPos(this.codeMirror.getCursor())
        );
    },

    render: function() {
        return ( <div id = "Editor" ref = "container" /> );
    }
});

module.exports = Editor;
