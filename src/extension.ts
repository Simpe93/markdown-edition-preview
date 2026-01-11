import * as vscode from "vscode";
import MarkdownIt from "markdown-it";

let currentEdition = "Se";
let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBar.command = "markdownEdition.selectEdition";
  statusBar.text = `Edition: ${currentEdition}`;
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("markdownEditin.selectEdition", async () => {
      const pick = await vscode.window.showQuickPick(["Se", "Cz", "Hu", "Th", "Ed"]);
      if (pick) {
        currentEdition = pick;
        statusBar.text = `Edition: ${currentEdition}`;
        updatePreview();
      }
    }),

    vscode.commands.registerCommand(
      "markdownEdition.showPreview",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active markdown file");
          return;
        }

        panel = vscode.window.createWebviewPanel("markdownEditionPreview", "Markdown Edition Preview",
          vscode.ViewColumn.Beside, { enableScripts: true });
        updatePreview(editor.document);
      }
    )
  );
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

  let html = md.render(filtered);
  panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <body>
      ${html}
    </body>
    </html>
  `;
}

export function deactivate() {}
