import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface CloudflareConfig {
    accountId: string;
    apiToken: string;
    accountHash: string;
    defaultVariant: string;
}

interface ImageCacheEntry {
    hash: string;
    url: string;
    fileName: string;
    uploadedAt: number;
}

interface ImageCache {
    [hash: string]: ImageCacheEntry;
}

// Global state for image cache
let imageCache: ImageCache = {};
let globalState: vscode.Memento | undefined;

// Calculate SHA-256 hash of a file buffer
function calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Load image cache from global state
function loadImageCache(): void {
    if (globalState) {
        imageCache = globalState.get<ImageCache>('imageCache', {});
    }
}

// Save image cache to global state
async function saveImageCache(): Promise<void> {
    if (globalState) {
        await globalState.update('imageCache', imageCache);
    }
}

// Add or retrieve image from cache
function getCachedImage(hash: string): ImageCacheEntry | undefined {
    return imageCache[hash];
}

// Add image to cache
async function addImageToCache(hash: string, url: string, fileName: string): Promise<void> {
    imageCache[hash] = {
        hash,
        url,
        fileName,
        uploadedAt: Date.now()
    };
    await saveImageCache();
}

// Clean up old cache entries (older than 30 days)
async function cleanupOldCacheEntries(): Promise<void> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let hasChanges = false;
    
    for (const hash in imageCache) {
        if (imageCache[hash].uploadedAt < thirtyDaysAgo) {
            delete imageCache[hash];
            hasChanges = true;
        }
    }
    
    if (hasChanges) {
        await saveImageCache();
    }
}

// Helper function to format image URL based on file type
function formatImageUrl(imageUrl: string, fileName: string, languageId: string): string {
    switch (languageId) {
        case 'html':
        case 'php':
        case 'vue':
        case 'svelte':
        case 'jsx':
        case 'tsx':
            return `<img src="${imageUrl}" alt="${fileName}" />`;
        
        case 'markdown':
            return `![${fileName}](${imageUrl})`;
        
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return `url('${imageUrl}')`;
        
        case 'json':
        case 'jsonc':
            return `"${imageUrl}"`;
        
        case 'javascript':
        case 'typescript':
        case 'javascriptreact':
        case 'typescriptreact':
            return `"${imageUrl}"`;
        
        case 'python':
        case 'ruby':
        case 'go':
        case 'rust':
        case 'java':
        case 'csharp':
        case 'cpp':
        case 'c':
            return `"${imageUrl}"`;
        
        default:
            // For plain text and unknown types, just insert the URL
            return imageUrl;
    }
}

// Shared helper function for processing image files from DataTransfer
async function processImageFiles(dataTransfer: vscode.DataTransfer, document: vscode.TextDocument): Promise<string[] | undefined> {
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
        let duplicateCount = 0;

        for (const file of imageFiles) {
            try {
                // Read the file data
                const data = await file.data();
                const buffer = Buffer.from(data);

                // Calculate hash to check for duplicates
                const fileHash = calculateFileHash(buffer);
                const cachedImage = getCachedImage(fileHash);

                let imageUrl: string | null = null;

                if (cachedImage) {
                    // Image already uploaded, reuse the URL
                    imageUrl = cachedImage.url;
                    duplicateCount++;
                } else {
                    // Create a temporary file
                    const tempDir = path.join(require('os').tmpdir(), 'cloudflare-images-upload');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    const tempFile = path.join(tempDir, `${Date.now()}-${file.name}`);
                    fs.writeFileSync(tempFile, buffer);

                    // Upload to Cloudflare
                    imageUrl = await uploadImageToCloudflare(tempFile, cloudflareConfig, fileHash, file.name);

                    // Clean up temp file
                    fs.unlinkSync(tempFile);
                }

                if (imageUrl) {
                    // Format the URL based on the document's language
                    const formattedUrl = formatImageUrl(imageUrl, file.name, document.languageId);
                    uploadedUrls.push(formattedUrl);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to upload ${file.name}: ${error}`);
            }
        }

        // Show info message if duplicates were detected
        if (duplicateCount > 0) {
            vscode.window.showInformationMessage(
                `${duplicateCount} duplicate image${duplicateCount > 1 ? 's' : ''} detected - reused existing URL${duplicateCount > 1 ? 's' : ''}`
            );
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
        const urls = await processImageFiles(dataTransfer, document);
        
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
        const urls = await processImageFiles(dataTransfer, document);
        
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
    // Initialize global state for image cache
    globalState = context.globalState;
    loadImageCache();
    
    // Clean up old cache entries on activation
    await cleanupOldCacheEntries();
    
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
                const fileName = path.basename(imagePath);
                
                // Check if image was already uploaded
                const fileBuffer = fs.readFileSync(imagePath);
                const fileHash = calculateFileHash(fileBuffer);
                const cachedImage = getCachedImage(fileHash);
                
                let imageUrl: string | null = null;
                
                if (cachedImage) {
                    imageUrl = cachedImage.url;
                    vscode.window.showInformationMessage('Duplicate image detected - reused existing URL');
                } else {
                    imageUrl = await uploadImageToCloudflare(imagePath, cloudflareConfig, fileHash, fileName);
                }
                
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

                // Convert base64 to buffer and check for duplicates
                const imageBuffer = Buffer.from(base64Data, 'base64');
                const fileHash = calculateFileHash(imageBuffer);
                const cachedImage = getCachedImage(fileHash);
                
                let imageUrl: string | null = null;
                
                if (cachedImage) {
                    imageUrl = cachedImage.url;
                } else {
                    // Create a temporary file
                    const tempDir = path.join(context.globalStorageUri.fsPath, 'temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }
                    
                    const tempFile = path.join(tempDir, `image-${Date.now()}.png`);
                    fs.writeFileSync(tempFile, base64Data, { encoding: 'base64' });

                    // Upload the image
                    imageUrl = await uploadImageToCloudflare(tempFile, cloudflareConfig, fileHash, 'image.png');
                    
                    // Clean up
                    fs.unlinkSync(tempFile);
                }
                
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
            } catch (error) {
                vscode.window.showErrorMessage(`Error processing pasted image: ${error}`);
            }
        }
    });

    // Supported file types
    const supportedLanguages = [
        'markdown', 'html', 'php', 'vue', 'svelte', 'jsx', 'tsx',
        'css', 'scss', 'sass', 'less',
        'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
        'json', 'jsonc',
        'python', 'ruby', 'go', 'rust', 'java', 'csharp', 'cpp', 'c',
        'plaintext'
    ];

    // Register drag and drop handler for all supported file types
    const dropProviders = supportedLanguages.map(lang => 
        vscode.languages.registerDocumentDropEditProvider(
            { language: lang },
            new ImageDropProvider()
        )
    );

    // Register paste handler for all supported file types
    const pasteProviders = supportedLanguages.map(lang =>
        vscode.languages.registerDocumentPasteEditProvider(
            { language: lang },
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
        )
    );

    context.subscriptions.push(disposable, setupDisposable, ...dropProviders, ...pasteProviders);
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

async function uploadImageToCloudflare(
    imagePath: string, 
    config: CloudflareConfig, 
    fileHash?: string, 
    fileName?: string
): Promise<string | null> {
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
        const imageUrl = `https://imagedelivery.net/${config.accountHash}/${imageId}${config.defaultVariant}`;
        
        // Store in cache if hash and fileName are provided
        if (fileHash && fileName) {
            await addImageToCache(fileHash, imageUrl, fileName);
        }
        
        return imageUrl;
    } catch (error) {
        vscode.window.showErrorMessage(`Upload failed: ${error}`);
        return null;
    }
}

export function deactivate() {}
