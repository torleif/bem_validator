"use strict";
var React = require('react');

var Adapters = require('./adapters/css');

var PropertyList = React.createClass({
  getDefaultProps: function() {
    return {
      object: {},
      deepOpen: false
    };
  },

  render: function() {
    var Element = require('./Element');
    var {
      focusPath,
      level,
      object
    } = this.props;

    var properties = Adapters.ObjectFormatterKeys(object).map(key => {
      var v = this.props.object[key];
      return (
        <Element
          key={key}
          name={key}
          focusPath={focusPath}
          deepOpen={this.props.deepOpen}
          focusError={this.props.focusError}
          value={v}
          level={level}
        />
      );
    });
    return <ul className="value-body">{properties}</ul>;
  }
});

module.exports = PropertyList;
