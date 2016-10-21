"use strict";

var React = require('react');

var IssueMessage = React.createClass({
  render: function() {
    return <div id="Issue">{this.props.message}</div>;
  }
});

module.exports = IssueMessage;
