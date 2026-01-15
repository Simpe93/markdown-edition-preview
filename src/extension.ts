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
    vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [
        vscode.workspace.workspaceFolders?.[0].uri ?? extensionContext.extensionUri
      ]
    }
  );

  panel.onDidDispose(() => {
    panel = undefined;
  });

  updatePreviewTitle();
}

function createMarkdownIt(webview: vscode.Webview, doc: vscode.TextDocument) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  }).use(require("markdown-it-task-lists"))
    .use(require("markdown-it-footnote"));

  const defaultImageRenderer = md.renderer.rules.image ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const srcIndex = token.attrIndex("src");

    if (srcIndex >= 0) {
      const src = token.attrs![srcIndex][1];

      // Only rewrite relative paths
      if (!src.startsWith("http") && !src.startsWith("data:")) {
        const imageUri = vscode.Uri.joinPath(doc.uri, "..", src);
        token.attrs![srcIndex][1] = webview.asWebviewUri(imageUri).toString();
      }
    }

    return defaultImageRenderer(tokens, idx, options, env, self);
  };

  return md;
}

function stripYamlFrontMatter(input: string): string {
  if (!input.startsWith("---")) {
    return input;
  }

  const end = input.indexOf("\n---", 3);
  if (end === -1) {
    return input;
  }

  return input.slice(end + 4).replace(/^\s+/, "");
}

function updatePreview(doc?: vscode.TextDocument) {
  if (!panel) {
    return;
  }

  const document = doc ?? lastMarkdownDocument;
  if (!document) {
    return;
  }

  const md = createMarkdownIt(panel.webview, document);
  const raw = document.getText();
  const noFrontMatter = stripYamlFrontMatter(raw);
  const filtered = filterByEdition(noFrontMatter, currentEdition);

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

function filterBlockByEdition(input: string, edition: string): string {
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

function filterInlineByEdition(input: string, edition: string): string {
  const inlineIfRegex =
    /<!--\s*if-inline:\s*([A-Za-z0-9_-]+(?:\s+or\s+[A-Za-z0-9_-]+)*)\s*-->([\s\S]*?)<!--\s*endif-inline\s*-->/g;

  return input.replace(inlineIfRegex, (_, editionsRaw, content) => {
    const allowedEditions = editionsRaw.split(/\s+or\s+/).map((s: string) => s.trim());
    return allowedEditions.includes(edition) ? content : "";
  });
}

function filterByEdition(input: string, edition: string): string {
  const blockFiltered = filterBlockByEdition(input, edition);
  const inlineFiltered = filterInlineByEdition(blockFiltered, edition);
  return inlineFiltered;
}

export function deactivate() {}
