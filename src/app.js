"use strict";

require('./Object.es7.shim');

var ASTOutput = require('./ASTOutput');
var Editor = require('./Editor');
var ErrorMessage = require('./ErrorMessage');
var IssueMessage = require('./IssueMessage');
var PasteDropTarget = require('./PasteDropTarget');
var PubSub = require('pubsub-js');
var React = require('react');
var Snippet = require('./Snippet');
var SplitPane = require('./SplitPane');
var Toolbar = require('./Toolbar');
var bem = require('./Bem');

var getFocusPath = require('./getFocusPath');
var getFocusBemPath = require('./getFocusBemPath');
var css = require('css');
var fs = require('fs');
var keypress = require('keypress').keypress;

var initialCode = fs.readFileSync(__dirname + '/codeExample.txt', 'utf8');
var indexFromPos = require('./adapters/css').indexFromPos;

function updateHashWithIDAndRevision(id, rev) {
  global.location.hash = '/' + id + (rev && rev !== 0 ? '/' + rev : '');
}

var App = React.createClass({
  getInitialState: function() {
    var snippet = this.props.snippet;
    var revision = this.props.revision;
    if ((snippet && !revision) || (!snippet && revision)) {
      throw Error('Must set both, snippet and revision');
    }
    return {
      forking: false,
      saving: false,
      ast: null,
      astbem: null,
      focusPath: [],
      focusBemPath: [],
      content: revision && revision.get('code') || initialCode,
      snippet: snippet,
      revision: revision,
      issues: null,
      focusError: null
    };
  },

  componentDidMount: function() {
    if (this.props.error) {
      this._showError(this.props.error);
    }
    global.onhashchange = function() {
      if (!this.state.saving || !this.state.forking) {
        Snippet.fetchFromURL().then(
          function(data) {
            if (data) {
              this._setRevision(data.snippet, data.revision);
            } else {
              this._clearRevision();
            }
          }.bind(this),
          function(error) {
            this._showError('Failed to fetch revision: ' + error.message);
          }.bind(this)
        );
      }
    }.bind(this);

    var listener = new keypress.Listener();
    listener.simple_combo('meta s', (event) => {
      event.preventDefault();
      this._onSave();
    });
    listener.simple_combo('cmd shift s', (event) => {
      event.preventDefault();
      this._onFork();
    });
    listener.simple_combo('ctrl alt s', (event) => {
      event.preventDefault();
      this._onFork();
    });

    PubSub.subscribe('HIGHLIGHTERRORS', function(_, bemErrors) {
      PubSub.publish('CM.HIGHLIGHTERRORS', bemErrors);
    });
    PubSub.subscribe('HIGHLIGHT', function(_, astNode) {
      PubSub.publish('CM.HIGHLIGHT', astNode.range || astNode.position);
    });
    PubSub.subscribe('CLEAR_HIGHLIGHT', function(_, astNode) {
      PubSub.publish('CM.CLEAR_HIGHLIGHT', astNode && (astNode.range || astNode.position));
    });
    PubSub.subscribe('MOVECURSOR', function(_, position) {
      PubSub.publish('CM.MOVECURSOR', position);
    });
  },

  _setRevision: function(snippet, revision) {
    if (!snippet || !revision) {
      this.setError('Something went wrong fetching the revision. Try to refresh!');
    }
    if (!this.state.snippet ||
        snippet.id !== this.state.snippet.id ||
        revision.id !== this.state.revision.id ||
        revision.get('code') !== this.state.revision.get('code')) {
      this.setState({
        snippet: snippet,
        revision: revision,
        content: revision.get('code'),
        focusPath: [],
        focusBemPath: []
      });
    }
  },

  _clearRevision: function() {
    this.setState({
      ast: css.parse(initialCode, {}),
      astbem: bem.parse(initialCode, {}),
      focusPath: [],
      focusBemPath: [],
      content: initialCode,
      snippet: null,
      revision: null,
      issues: null
    });
  },

  onContentChange: function(data) {
    var content = data.value;
    var cursor = data.cursor;
    if (this.state.ast && this.state.content === content) {
      return;
    }

    var ast;
    var astbem;
    try {
      ast = css.parse(content, {});
      astbem = bem.parse(content, {});
    }
    catch(e) {
    //  console.log(e)
      this.setState({
        error: 'Syntax error: ' + e.message,
        content: content,
      });
    }

    if (ast) {
      var doc = this.refs.editor && this.refs.editor.getDocument();
      //console.log( cursor ? getFocusPath(ast, cursor, [], doc): []);
      this.setState({
        content: content,
        ast: ast,
        astbem: astbem,
        focusPath: cursor ? getFocusPath(ast, cursor, [], doc): [],
        focusBemPath: cursor ? getFocusBemPath(astbem, cursor, [], doc): [],
        error: null,
        issues: astbem ? bem.bemValidationMessage() : null
      });
    }
  },
  buildFocusError: function(ast, cursorPos, doc) {
      for (var i = 0; i < ast.Errors.length; i++) {
          var error = ast.Errors[i];
          var ix = indexFromPos(error.position.start, doc);
          var iy = indexFromPos(error.position.end, doc);
          if (cursorPos >= ix && cursorPos <= iy) {
              return error;
          }
      }
      return null;
  },

  onActivity: function(cursorPos) {
    var doc = this.refs.editor && this.refs.editor.getDocument();
    var myfocuserror = this.buildFocusError(this.state.astbem, cursorPos, doc);
    var myfocuspath = new Array();
    var focuspathitr = getFocusPath(this.state.ast, cursorPos, [], doc);

    // we exclude the declarations and selectors if selecting an error
    if(myfocuserror) {
      outer_loop:
      for(var focuspath in focuspathitr) {
        if(Array.isArray(focuspathitr[focuspath])) {
          for(var checkrul in focuspathitr[focuspath]) {
              var rule = focuspathitr[focuspath][checkrul];
            if(typeof rule === 'object' && 'type' in rule && rule['type'] == "declaration") {
    	          break outer_loop;
            }
          }
        }
        myfocuspath.push(focuspathitr[focuspath]);
      }
    } else {
      myfocuspath = focuspathitr;
    }
    
    this.setState({
      focusPath: myfocuspath,
      focusBemPath: getFocusBemPath(this.state.astbem, cursorPos, [], doc),
      focusError: myfocuserror
    });
  },

  _showError: function(msg) {
    this.setState({error: msg});
    setTimeout(function() {
      if (msg === this.state.error) {
        this.setState({error: false});
      }
    }.bind(this), 3000);
  },

  _save: function(fork) {
    var snippet = !fork && this.state.snippet || new Snippet();
    var code = this.refs.editor.getValue();
    if (snippet.get('code') === code) return;
    this.setState({saving: !fork, forking: fork});
    snippet.createNewRevision({code: code}).then(
      function(response) {
        if (response) {
          updateHashWithIDAndRevision(snippet.id, response.revisionNumber);
        }
        this.setState({
          saving: false,
          forking: false,
        });
      }.bind(this),
      function(snippet, error) {
        this._showError('Could not save: ' + error.message);
        this.setState({saving: false, forking: false});
      }.bind(this)
    );
  },

  _onSave: function() {
    var revision = this.state.revision;
    if (this.state.content !== initialCode && !revision ||
        revision && revision.get('code') !== this.state.content) {
      this._save();
    }
  },

  _onFork: function() {
    if (!!this.state.revision) {
      this._save(true);
    }
  },

  _onResize: function() {
    PubSub.publish('PANEL_RESIZE');
  },

  _onDropText: function(type, event, text) {
    this.onContentChange({value: text});
  },

  _onDropError: function(type, event, msg) {
    this._showError(msg);
  },

  render: function() {
    var revision = this.state.revision;
    return (
      <PasteDropTarget
        className="dropTarget"
        dropindicator={
          <div className="dropIndicator">
            <div>Drop a CSS or (JSON-encoded) AST file here</div>
          </div>
        }
        onText={this._onDropText}
        onError={this._onDropError}>
        <Toolbar
          forking={this.state.forking}
          saving={this.state.saving}
          onSave={this._onSave}
          onFork={this._onFork}
          canSave={
            this.state.content !== initialCode && !revision ||
            revision && revision.get('code') !== this.state.content
          }
          canFork={!!revision}
        />
        {this.state.issues ? <IssueMessage message={this.state.issues} /> : null}
        {this.state.error ? <ErrorMessage message={this.state.error} /> : null}
        <SplitPane
          className={this.state.error || this.state.issues ? "splitpane splitpane-error" : "splitpane"}
          onResize={this._onResize}>
          <Editor
            ref="editor"
            value={this.state.content}
            onContentChange={this.onContentChange}
            onActivity={this.onActivity}
            focusError={this.state.focusError}
          />
          <ASTOutput focusError={this.state.focusError} focusPath={this.state.focusPath} focusBemPath={this.state.focusBemPath} ast={this.state.ast} astbem={this.state.astbem} />
        </SplitPane>
      </PasteDropTarget>
    );
  }
});

function render(props) {
  React.render(
    <App {...props} />,
    document.getElementById('container')
  );
}

Snippet.fetchFromURL().then(
  function(data) {
    render(data);
  },
  function(error) {
    render({error: 'Failed to fetch revision: ' + error.message});
  }
);
