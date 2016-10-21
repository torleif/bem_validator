## BEM (Block Element Modifier) Validation Service.

**This is a fork of @iamdustan’s [iamdustan’s AST explorer](https://github.com/iamdustan/reworkcss_ast_explorer)**

which is forked from

**This is a fork of @fkling’s [Esprima AST Explorer](https://github.com/fkling/esprima_ast_explorer)**

Paste CSS code into the editor and inspect the generated AST.

The CSS AST explorer uses [rework/css](https://github.com/reworkcss/css) to
parse the code.

### Features

- Validate BEM CSS
- Save and fork code snippets. Copy the URL to share them.
- Copying an AST or dropping a file containing an AST into the window will
parse the AST and update the code using [css](https://github.com/reworkcss/css).
- Otherwise, the content of texteditor will be replaced with the content of the file (i.e.
you can drag and drop CSS files).
- shift+click on a node expands the full subtree.
- Hovering over a node highlights the corresponding text in the source code:
![source highlight](assets/source.png)


### Contributions

This project is a fork of [https://github.com/fkling/esprima_ast_explorer](https://github.com/fkling/esprima_ast_explorer).
There are a few integration bugs due to using a different AST generator which
haven’t been handled yet. Most feature requests or other issues should likely be
filed on the esprima_ast_explorer issue tracker: [https://github.com/fkling/esprima_ast_explorer/issues](https://github.com/fkling/esprima_ast_explorer/issues).

#### Build your own version

Install all dependencies with `npm install`.

Run `npm run watch` for incremental builds (while hacking the code), and
`npm run build` for the final minimized version.

Run `npm start` to start a simple static webserver.
