/*
*  todo:        bmcode plugin extension
*  created:     2019-8-21
*  author:      xuwei
*/
"use strict";
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const UglifyJS = require('uglify-js');
const jsbeautify = require("js-beautify");
const babel = require('@babel/core');
let hasStatus = false;

/**
 * Welcome
 */
let helloBmcode = vscode.commands.registerCommand('Bmcode.hello', () => {
    if (hasStatus) {
        vscode.window.setStatusBarMessage('');
    } else {
        vscode.window.showInformationMessage('Hi Bmcode Developer!');
        vscode.window.setStatusBarMessage('每一节编程课, 都是一个故事.');
    }
    hasStatus = !hasStatus;
});

/**
 * Execution when commands are invoked in the editor
 * @param {TextEditor} textEditor 
 */
let bmEditorCommand = vscode.commands.registerTextEditorCommand('Bmcode.bmEditorCommand', textEditor => { });

/**
 * Detecting whether a file can trigger a function
 * @param {TextDocument} document 
 */
let onSaveDocument = vscode.workspace.onDidSaveTextDocument(document => {
    if (/BM_PROJECT_PATH( ?)\(.*?\)/g.test(document.lineAt(0).text)) {
        compressJStoJSON(document);
    }
});

/**
 * on document format
 */
let onDocumentFormat = vscode.languages.registerDocumentFormattingEditProvider('bm', {
    provideDocumentFormattingEdits: (document, options, token) => {
        return format(document, null, options);
    }
})

/**
 * on document range format
 */
let onDocumentRangeFormat = vscode.languages.registerDocumentRangeFormattingEditProvider('bm', {
    provideDocumentRangeFormattingEdits: (document, range, options, token) => {
        let start = new vscode.Position(0, 0);
        let end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        return format(document, new vscode.Range(start, end), options);
    }
})

/**
 * compress JS to JSON
 * @param {TextDocument} document
 */
let compressJStoJSON = document => {
    let jsonName = document.lineAt(0).text.match(/(?<=(BM_PROJECT_PATH( ?)\()).*?(?=\))/g)[0];
    let jsonUri = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, jsonName);
    jsonUri = path.resolve(document.fileName, '../' , jsonName.includes('../') ? jsonName : jsonUri);
    try {
        fs.accessSync(jsonUri);
    } catch (e) {
        vscode.window.showInformationMessage('path does not exist');
        return;
    }
    let es5Js = babel.transformSync(document.getText().trim(), {
        sourceType: 'script',
        comments: false,
        presets: [path.resolve(__dirname, '../', 'node_modules', '@babel/preset-env')]
    }).code;
    let data = UglifyJS.minify(es5Js, {
        compress: {
            dead_code: true,
            booleans: true,
            unused: true,
            global_defs: { DEBUG: false }
        }
    }).code.toString().replace(/\"/g, "'");
    let jsonData = fs.readFileSync(jsonUri, 'utf8');
    if (!(/"evalFunc":( ?)".*?"/g.test(jsonData))) {
        vscode.window.showInformationMessage('not found "evalFunc"');
        return;
    }
    jsonData = jsonData.replace(/(?<="evalFunc":( ?)\").*?(?=\")/g, data);
    fs.writeFileSync(jsonUri, jsonData);
}

/**
 * format
 * @param {TextDocument} document 
 * @param {Range} range 
 * @param {Object} options 
 */
function format(document, range, options) {
    if (range === null) {
        let start = new vscode.Position(0, 0);
        let end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        range = new vscode.Range(start, end);
    }
    let result = [];
    let content = document.getText(range);
    if (!options) {
        options = { insertSpaces: true, tabSize: 2 };
    }
    let beutifyOptions = {
        indent_char: ' ',
        indent_size: 2,
        selector_separator_newline: false,
        brace_style: 'none,preserve-inline',
        max_preserve_newlines: 2
    };
    let formatted = jsbeautify.js_beautify(content, beutifyOptions);
    if (formatted) {
        result.push(new vscode.TextEdit(range, formatted));
    }
    return result;
}

/**
 * Triggered when the plugin is activated, the total entry to all code
 * @param {ExtensionContext} context Plugin context
 */
exports.activate = context => {
    let sub = context.subscriptions;
    sub.push(helloBmcode);
    sub.push(bmEditorCommand);
    sub.push(onSaveDocument);
    sub.push(onDocumentFormat);
    sub.push(onDocumentRangeFormat);
};

/**
 * Triggered when the plugin is released
 */
exports.deactivate = function () { };