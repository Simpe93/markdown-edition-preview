import * as vscode from "vscode";
import MarkdownIt from "markdown-it";

let currentEdition = "Se";
let extensionContext: vscode.ExtensionContext;
let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBar.command = "markdownEdition.selectEdition";
  statusBar.text = `Edition: ${currentEdition}`;
  statusBar.show();
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
      statusBar.text = `Edition: ${currentEdition}`;

      ensurePreview();
      updatePreview();
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
}

function ensurePreview() {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  panel = vscode.window.createWebviewPanel("markdownEditionPreview", "Edition Preview",
    vscode.ViewColumn.Beside, { enableScripts: true });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

function updatePreview(doc?: vscode.TextDocument) {
  if (!panel) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const document = doc ?? editor?.document;
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
    const startMatch = line.match(/^<!--\s*Config\s*=\s*([A-Za-z0-9_|-]+)\s*-->$/);
    const stopMatch = line.match(/^<!--\s*Config\s*-->$/);

    if (startMatch) {
      allowedEditions = startMatch[1].split("|");
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
