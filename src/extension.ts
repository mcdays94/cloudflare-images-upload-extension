import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface CloudflareConfig {
    accountId: string;
    apiToken: string;
    accountHash: string;
    defaultVariant: string;
}

// Shared helper function for processing image files from DataTransfer
async function processImageFiles(dataTransfer: vscode.DataTransfer): Promise<string[] | undefined> {
    // Check if Cloudflare is configured
    const cloudflareConfig = getCloudflareConfig();
    if (!cloudflareConfig) {
        vscode.window.showErrorMessage('Please configure Cloudflare credentials in settings');
        return undefined;
    }

    // Look for image files in the data transfer
    const imageFiles: vscode.DataTransferFile[] = [];
    
    dataTransfer.forEach((item, mimeType) => {
        if (mimeType.startsWith('image/')) {
            const file = item.asFile();
            if (file) {
                imageFiles.push(file);
            }
        }
    });

    if (imageFiles.length === 0) {
        return undefined;
    }

    // Show progress notification
    const uploadPromise = (async () => {
        const uploadedUrls: string[] = [];

        for (const file of imageFiles) {
            try {
                // Read the file data
                const data = await file.data();
                const buffer = Buffer.from(data);

                // Create a temporary file
                const tempDir = path.join(require('os').tmpdir(), 'cloudflare-images-upload');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const tempFile = path.join(tempDir, `${Date.now()}-${file.name}`);
                fs.writeFileSync(tempFile, buffer);

                // Upload to Cloudflare
                const imageUrl = await uploadImageToCloudflare(tempFile, cloudflareConfig);

                // Clean up temp file
                fs.unlinkSync(tempFile);

                if (imageUrl) {
                    uploadedUrls.push(`![${file.name}](${imageUrl})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to upload ${file.name}: ${error}`);
            }
        }

        return uploadedUrls;
    })();

    // Wait for uploads with progress
    const urls = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Uploading ${imageFiles.length} image(s) to Cloudflare...`,
            cancellable: false
        },
        async () => uploadPromise
    );

    return urls.length > 0 ? urls : undefined;
}

class ImageDropProvider implements vscode.DocumentDropEditProvider {
    async provideDocumentDropEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentDropEdit | undefined> {
        const urls = await processImageFiles(dataTransfer);
        
        if (!urls) {
            return undefined;
        }

        // Create the edit with markdown links
        const snippet = new vscode.SnippetString(urls.join('\n'));
        return { insertText: snippet };
    }
}

class ImagePasteProvider implements vscode.DocumentPasteEditProvider {
    async provideDocumentPasteEdits(
        document: vscode.TextDocument,
        ranges: readonly vscode.Range[],
        dataTransfer: vscode.DataTransfer,
        context: vscode.DocumentPasteEditContext,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentPasteEdit[] | undefined> {
        const urls = await processImageFiles(dataTransfer);
        
        if (!urls) {
            return undefined;
        }

        // Create the edit with markdown links
        const snippet = new vscode.SnippetString(urls.join('\n'));
        const edit: vscode.DocumentPasteEdit = {
            insertText: snippet,
            title: 'Upload to Cloudflare Images',
            kind: undefined as any
        };
        return [edit];
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('cloudflareImagesUpload');
    
    // Register the upload command
    let disposable = vscode.commands.registerCommand('cloudflareImages.uploadImage', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor');
            return;
        }

        // Check if configuration is complete
        const cloudflareConfig = getCloudflareConfig();
        if (!cloudflareConfig) {
            vscode.window.showErrorMessage('Please configure Cloudflare credentials in settings');
            return;
        }

        // Handle image upload
        try {
            const result = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Upload',
                filters: {
                    'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp']
                }
            });

            if (result && result[0]) {
                const imagePath = result[0].fsPath;
                const imageUrl = await uploadImageToCloudflare(imagePath, cloudflareConfig);
                
                if (imageUrl) {
                    const markdown = `![${path.basename(imagePath)}](${imageUrl})`;
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, markdown);
                    });
                    vscode.window.showInformationMessage('Image uploaded successfully!');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error uploading image: ${error}`);
        }
    });

    // Register the setup command
    let setupDisposable = vscode.commands.registerCommand('cloudflareImages.setup', async () => {
        vscode.window.showInformationMessage(
            'To configure Cloudflare Images Upload:\n\n' +
            '1. Open Settings (Cmd+, or Ctrl+,)\n' +
            '2. Search for "Cloudflare Images Upload"\n' +
            '3. Configure:\n' +
            '   - Account ID\n' +
            '   - API Token (with Images:Edit permission)\n' +
            '   - Account Hash (from Images dashboard URL)\n' +
            '   - Default Variant (e.g., /public)',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'cloudflareImagesUpload');
            }
        });
    });

    // Register paste handler
    vscode.workspace.onDidChangeTextDocument(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !event.contentChanges.length) {
            return;
        }

        // Check if the change is a paste operation
        const change = event.contentChanges[0];
        if (change.text && change.text.startsWith('data:image/')) {
            try {
                const cloudflareConfig = getCloudflareConfig();
                if (!cloudflareConfig) {
                    vscode.window.showErrorMessage('Please configure Cloudflare credentials in settings');
                    return;
                }

                // Get the base64 data from the pasted image
                const base64Data = change.text.split(';base64,').pop();
                if (!base64Data) {
                    return;
                }

                // Create a temporary file
                const tempDir = path.join(context.globalStorageUri.fsPath, 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                
                const tempFile = path.join(tempDir, `image-${Date.now()}.png`);
                fs.writeFileSync(tempFile, base64Data, { encoding: 'base64' });

                // Upload the image
                const imageUrl = await uploadImageToCloudflare(tempFile, cloudflareConfig);
                
                // Replace the pasted base64 with the image URL
                if (imageUrl) {
                    const markdown = `![image](${imageUrl})`;
                    const start = change.range.start;
                    const end = new vscode.Position(change.range.end.line, change.range.end.character);
                    const range = new vscode.Range(start, end);
                    
                    editor.edit(editBuilder => {
                        editBuilder.replace(range, markdown);
                    });
                }

                // Clean up
                fs.unlinkSync(tempFile);
            } catch (error) {
                vscode.window.showErrorMessage(`Error processing pasted image: ${error}`);
            }
        }
    });

    // Register drag and drop handler for markdown files
    const dropProvider = vscode.languages.registerDocumentDropEditProvider(
        { language: 'markdown' },
        new ImageDropProvider()
    );

    // Register paste handler for markdown files
    const pasteProvider = vscode.languages.registerDocumentPasteEditProvider(
        { language: 'markdown' },
        new ImagePasteProvider(),
        {
            pasteMimeTypes: [
                'image/png',
                'image/jpeg',
                'image/jpg',
                'image/gif',
                'image/webp',
                'image/bmp',
                'image/svg+xml'
            ],
            providedPasteEditKinds: []
        }
    );

    context.subscriptions.push(disposable, setupDisposable, dropProvider, pasteProvider);
}

function getCloudflareConfig(): CloudflareConfig | null {
    const config = vscode.workspace.getConfiguration('cloudflareImagesUpload');
    const accountId = config.get<string>('accountId');
    const apiToken = config.get<string>('apiToken');
    const accountHash = config.get<string>('accountHash');
    const defaultVariant = config.get<string>('defaultVariant') || '/public';

    if (!accountId || !apiToken || !accountHash) {
        return null;
    }

    return {
        accountId,
        apiToken,
        accountHash,
        defaultVariant
    };
}

async function uploadImageToCloudflare(imagePath: string, config: CloudflareConfig): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath));
        formData.append('requireSignedURLs', 'false');

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiToken}`,
                    ...formData.getHeaders()
                },
                body: formData
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to upload image: ${error}`);
        }

        const data = await response.json() as any;
        const imageId = data.result.id;
        
        // Construct the public URL
        return `https://imagedelivery.net/${config.accountHash}/${imageId}${config.defaultVariant}`;
    } catch (error) {
        vscode.window.showErrorMessage(`Upload failed: ${error}`);
        return null;
    }
}

export function deactivate() {}
