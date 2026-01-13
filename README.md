# Markdown Edition Preview
A VS Code extension that allows you to preview Markdown files for different
**editions** using special comment blocks.

## Features
- Conditional Markdown blocks
- Live preview updates
- Status bar edition selector

## Syntax
<!-- if: Test1 or Test2 -->
This content is only visible for Test1 and Test2
<!-- endif -->

<!-- if: Test3 -->
This is only visible for Test3
<!-- endif -->

## Build
1. Clone the repo

2. Install dependencies
npm install

3. Build the extension
npm run compile

4. Install packaging tool
npm install -g @vscode/vsce

5. Create VSIX
vsce package

6. Use file
markdown-edition-preview-x.x.x.vsix

## Run locally
1. Open this project in VS Code
2. Press F5 and run Extension Development Host
4. Open any .md file
5. Ctrl+Shift+P > Markdown: Show Preview
6. Switch configs using the status bar

## Install VSIX
1. Open VS Code
2. Go to Extensions
3. Click ⋮
4. Select Install from VSIX
5. Choose the .vsix file
6. Enjoy