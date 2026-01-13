import * as vscode from "vscode";
import MarkdownIt from "markdown-it";

let currentEdition = "Se";
let extensionContext: vscode.ExtensionContext;
let panel: vscode.WebviewPanel | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let lastMarkdownDocument: vscode.TextDocument | undefined;

function updateStatusBar() {
  const editor = vscode.window.activeTextEditor;

  if (statusBar) {
    if (editor && editor.document.languageId === "markdown") {
      statusBar.text = `Edition: ${currentEdition}`;
      statusBar.show();
    } else {
      statusBar.hide();
    }
  }
}

function updatePreviewTitle() {
  if (!panel || !lastMarkdownDocument) {
    return;
  }

  const fileName = lastMarkdownDocument.isUntitled
    ? "Untitled"
    : lastMarkdownDocument.uri.path.split("/").pop() ?? "Untitled";

  panel.title = `Preview (${currentEdition}) — ${fileName}`;
}

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBar.command = "markdownEdition.selectEdition";
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("markdownEdition.selectEdition", async () => {
      const pick = await vscode.window.showQuickPick(["Se", "Cz", "Hu", "Th", "Ed"], {
        placeHolder: "Select edition",
      });

      if (!pick) {
        return;
      }

      currentEdition = pick;

      updateStatusBar();
      ensurePreview();
      updatePreview();
      updatePreviewTitle();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("markdownEdition.showPreview", () => {
      ensurePreview();
      updatePreview();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        updatePreview(e.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateStatusBar();

      if (editor?.document.languageId === "markdown") {
        lastMarkdownDocument = editor.document;
        updatePreview(editor.document);
        updatePreviewTitle();
      }
    })
  );

  updateStatusBar();
}

function ensurePreview() {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    updatePreviewTitle();
    return;
  }

  panel = vscode.window.createWebviewPanel("markdownEditionPreview", "Edition Preview",
    vscode.ViewColumn.Beside, { enableScripts: true });

  panel.onDidDispose(() => {
    panel = undefined;
  });

  updatePreviewTitle();
}

function updatePreview(doc?: vscode.TextDocument) {
  if (!panel) {
    return;
  }

  const document = doc ?? lastMarkdownDocument;
  if (!document) {
    return;
  }

  const md = new MarkdownIt();
  const filtered = filterByEdition(document.getText(), currentEdition);

  const cssUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(extensionContext.extensionUri, "media", "markdown.css")
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="${cssUri}">
        <style>
          h1,
          h2,
          h3 {
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
          }
        </style>
      </head>
      <body>
        ${md.render(filtered)}
      </body>
    </html>
  `;
}

function filterByEdition(input: string, edition: string): string {
  const lines = input.split(/\r?\n/);
  const output: string[] = [];

  let allowedEditions: string[] | null = null;
  let include = true;

  for (const line of lines) {
    const startMatch = line.match(/^<!--\s*if:\s*([A-Za-z0-9_-]+(?:\s+or\s+[A-Za-z0-9_-]+)*)\s*-->$/);
    const stopMatch = line.match(/^<!--\s*endif\s*-->$/);

    if (startMatch) {
      allowedEditions = startMatch[1].split(/\s+or\s+/).map(s => s.trim());
      include = allowedEditions.includes(edition);
      continue;
    }

    if (stopMatch) {
      allowedEditions = null;
      include = true;
      continue;
    }

    if (include) {
      output.push(line);
    }
  }

  return output.join("\n");
}

export function deactivate() {}
