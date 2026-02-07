import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import FormData from 'form-data';
import fetch from 'node-fetch';
import sharp from 'sharp';

interface CloudflareConfig {
    accountId: string;
    apiToken: string;
    accountHash: string;
    defaultVariant: string;
    useSignedUrls: boolean;
    signingKey: string;
    signedUrlExpiration: number;
}

interface CompressionConfig {
    enableCompression: boolean;
    maxFileSizeMB: number;
    compressionQuality: number;
    preservePngFormat: boolean;
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

interface TrackedImage {
    imageId: string;
    url: string;
    documentUri: string;
    insertedAt: number;
}

// Global state for image cache
let imageCache: ImageCache = {};
let globalState: vscode.Memento | undefined;

// Cached signing key
let cachedSigningKey: string | null = null;

// Track recently inserted images for deletion detection
const recentlyInsertedImages: Map<string, TrackedImage> = new Map();
const TRACKING_DURATION = 5 * 60 * 1000; // Track for 5 minutes after insertion

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

// Get compression config from settings
function getCompressionConfig(): CompressionConfig {
    const config = vscode.workspace.getConfiguration('cloudflareImagesUpload');
    return {
        enableCompression: config.get<boolean>('enableCompression', true),
        maxFileSizeMB: config.get<number>('maxFileSizeMB', 10),
        compressionQuality: config.get<number>('compressionQuality', 80),
        preservePngFormat: config.get<boolean>('preservePNGFormat', false)
    };
}

// Compress image if it exceeds the max file size
async function compressImageIfNeeded(
    imagePath: string,
    compressionConfig: CompressionConfig
): Promise<{ path: string; wasCompressed: boolean; originalSize: number; newSize: number }> {
    const stats = fs.statSync(imagePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    const originalSize = stats.size;

    // If compression is disabled or file is under the limit, return original
    if (!compressionConfig.enableCompression || fileSizeMB <= compressionConfig.maxFileSizeMB) {
        return { path: imagePath, wasCompressed: false, originalSize, newSize: originalSize };
    }

    const ext = path.extname(imagePath).toLowerCase();
    
    // Skip compression for SVG and GIF (animated) - these don't compress well with sharp
    if (ext === '.svg' || ext === '.gif') {
        return { path: imagePath, wasCompressed: false, originalSize, newSize: originalSize };
    }

    try {
        const tempDir = os.tmpdir();
        // Determine output extension based on format and settings
        let outputExt = ext;
        if (ext === '.png' && !compressionConfig.preservePngFormat) {
            outputExt = '.jpg';
        } else if (ext === '.heic' || ext === '.heif' || ext === '.bmp') {
            outputExt = '.jpg';
        }
        const tempFileName = `cf-compressed-${Date.now()}${outputExt}`;
        const tempPath = path.join(tempDir, tempFileName);

        let quality = compressionConfig.compressionQuality;
        let compressedBuffer: Buffer;
        let attempts = 0;
        const maxAttempts = 5;

        // Progressively reduce quality until under the limit
        do {
            const sharpInstance = sharp(imagePath);
            
            if (ext === '.png' && compressionConfig.preservePngFormat) {
                // Keep PNG format with compression
                compressedBuffer = await sharpInstance
                    .png({ compressionLevel: 9, palette: true })
                    .toBuffer();
            } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.heic' || ext === '.heif' || ext === '.bmp') {
                // Convert to JPEG for better compression
                compressedBuffer = await sharpInstance
                    .jpeg({ quality, mozjpeg: true })
                    .toBuffer();
            } else if (ext === '.webp') {
                compressedBuffer = await sharpInstance
                    .webp({ quality })
                    .toBuffer();
            } else {
                // For other formats, try JPEG
                compressedBuffer = await sharpInstance
                    .jpeg({ quality, mozjpeg: true })
                    .toBuffer();
            }

            const compressedSizeMB = compressedBuffer.length / (1024 * 1024);
            
            if (compressedSizeMB <= compressionConfig.maxFileSizeMB) {
                fs.writeFileSync(tempPath, compressedBuffer);
                return { 
                    path: tempPath, 
                    wasCompressed: true, 
                    originalSize, 
                    newSize: compressedBuffer.length 
                };
            }

            // Reduce quality for next attempt
            quality = Math.max(10, quality - 15);
            attempts++;
        } while (attempts < maxAttempts);

        // If still too large after max attempts, return the last compressed version
        fs.writeFileSync(tempPath, compressedBuffer!);
        return { 
            path: tempPath, 
            wasCompressed: true, 
            originalSize, 
            newSize: compressedBuffer!.length 
        };

    } catch (error) {
        console.error('Compression failed:', error);
        // Return original if compression fails
        return { path: imagePath, wasCompressed: false, originalSize, newSize: originalSize };
    }
}

// Fetch signing key from Cloudflare API
async function fetchSigningKey(accountId: string, apiToken: string): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/keys`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiToken}`
                }
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to fetch signing keys: ${error}`);
            return null;
        }

        const data = await response.json() as any;
        if (data.success && data.result?.keys?.length > 0) {
            // Return the first (default) signing key
            return data.result.keys[0].value;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching signing key: ${error}`);
        return null;
    }
}

// Get signing key (from cache, settings, or API)
async function getSigningKey(accountId: string, apiToken: string, manualKey?: string): Promise<string | null> {
    // If user provided a manual key, use it
    if (manualKey) {
        return manualKey;
    }
    
    // Check cache first
    if (cachedSigningKey) {
        return cachedSigningKey;
    }
    
    // Check global state cache
    if (globalState) {
        const storedKey = globalState.get<string>('signingKey');
        if (storedKey) {
            cachedSigningKey = storedKey;
            return storedKey;
        }
    }
    
    // Fetch from API
    const key = await fetchSigningKey(accountId, apiToken);
    if (key) {
        cachedSigningKey = key;
        // Store in global state for persistence
        if (globalState) {
            await globalState.update('signingKey', key);
        }
    }
    return key;
}

// Generate a signed URL for Cloudflare Images
function generateSignedUrl(imageId: string, variant: string, config: CloudflareConfig): string {
    // URL path format: /<accountHash>/<imageId>/<variant>
    const urlPath = `/${config.accountHash}/${imageId}${variant}`;
    
    // Calculate expiration timestamp (Unix time in seconds)
    let expiry: number | null = null;
    if (config.signedUrlExpiration > 0) {
        expiry = Math.floor(Date.now() / 1000) + config.signedUrlExpiration;
    }
    
    // Create the string to sign
    // Format: <url_path>?exp=<expiry> (if expiry is set) or just <url_path>
    let stringToSign = urlPath;
    if (expiry !== null) {
        stringToSign = `${urlPath}?exp=${expiry}`;
    }
    
    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', config.signingKey);
    hmac.update(stringToSign);
    const signature = hmac.digest('hex');
    
    // Construct the final signed URL
    let signedUrl = `https://imagedelivery.net${urlPath}`;
    if (expiry !== null) {
        signedUrl += `?exp=${expiry}&sig=${signature}`;
    } else {
        signedUrl += `?sig=${signature}`;
    }
    
    return signedUrl;
}

// Extract image ID from Cloudflare URL
function extractImageIdFromUrl(url: string): string | null {
    // Format: https://imagedelivery.net/{accountHash}/{imageId}/{variant}
    const match = url.match(/imagedelivery\.net\/[^\/]+\/([^\/]+)/);
    return match ? match[1] : null;
}

// Track an inserted image URL
function trackInsertedImage(url: string, documentUri: string): void {
    const imageId = extractImageIdFromUrl(url);
    if (!imageId) {
        return;
    }
    
    recentlyInsertedImages.set(url, {
        imageId,
        url,
        documentUri,
        insertedAt: Date.now()
    });
    
    // Auto-cleanup after tracking duration
    setTimeout(() => {
        recentlyInsertedImages.delete(url);
    }, TRACKING_DURATION);
}

// Delete image from Cloudflare
async function deleteImageFromCloudflare(imageId: string, config: CloudflareConfig): Promise<boolean> {
    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1/${imageId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${config.apiToken}`
                }
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to delete image: ${error}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`Error deleting image: ${error}`);
        return false;
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
    const cloudflareConfig = await getCloudflareConfig();
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
                    
                    // Track this URL for potential deletion
                    trackInsertedImage(imageUrl, document.uri.toString());
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
        const cloudflareConfig = await getCloudflareConfig();
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
                    'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif']
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
                    
                    // Track this URL for potential deletion
                    trackInsertedImage(imageUrl, editor.document.uri.toString());
                    
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
                const cloudflareConfig = await getCloudflareConfig();
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
                    'image/svg+xml',
                    'image/heic',
                    'image/heif'
                ],
                providedPasteEditKinds: []
            }
        )
    );

    // Register deletion detection listener (if enabled in settings)
    const deletionListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const config = vscode.workspace.getConfiguration('cloudflareImagesUpload');
        const deleteOnRemoval = config.get<boolean>('deleteOnRemoval', false);
        
        if (!deleteOnRemoval || !event.contentChanges.length) {
            return;
        }

        // Check if text was deleted
        for (const change of event.contentChanges) {
            if (change.text === '' && change.rangeLength > 0) {
                // Text was deleted - check which tracked URLs are no longer in the document
                const currentDocumentText = event.document.getText();
                const documentUri = event.document.uri.toString();
                
                // Check all tracked images for this document
                for (const [url, trackedImage] of recentlyInsertedImages.entries()) {
                    if (trackedImage.documentUri === documentUri && !currentDocumentText.includes(url)) {
                        // This URL was in the document but is no longer present
                        const cloudflareConfig = await getCloudflareConfig();
                        if (!cloudflareConfig) {
                            recentlyInsertedImages.delete(url);
                            continue;
                        }

                        // Check if we should skip confirmation
                        const deleteWithoutConfirmation = vscode.workspace.getConfiguration('cloudflareImagesUpload').get<boolean>('deleteWithoutConfirmation', false);
                        
                        let shouldDelete = false;
                        if (deleteWithoutConfirmation) {
                            // Skip confirmation, delete automatically
                            shouldDelete = true;
                        } else {
                            // Show confirmation dialog
                            const choice = await vscode.window.showWarningMessage(
                                `Image URL removed. Delete from Cloudflare Images?`,
                                'Delete',
                                'Keep'
                            );
                            shouldDelete = choice === 'Delete';
                        }

                        if (shouldDelete) {
                            const success = await deleteImageFromCloudflare(trackedImage.imageId, cloudflareConfig);
                            if (success) {
                                vscode.window.showInformationMessage('Image deleted from Cloudflare Images');
                                
                                // Also remove from cache if present
                                for (const hash in imageCache) {
                                    if (imageCache[hash].url === url) {
                                        delete imageCache[hash];
                                        await saveImageCache();
                                        break;
                                    }
                                }
                            } else {
                                vscode.window.showErrorMessage('Failed to delete image from Cloudflare');
                            }
                        }
                        
                        // Remove from tracking regardless of choice
                        recentlyInsertedImages.delete(url);
                    }
                }
            }
        }
    });

    context.subscriptions.push(disposable, setupDisposable, ...dropProviders, ...pasteProviders, deletionListener);
}

function getCloudflareConfigSync(): { accountId: string; apiToken: string; accountHash: string; defaultVariant: string; useSignedUrls: boolean; manualSigningKey: string; signedUrlExpiration: number } | null {
    const config = vscode.workspace.getConfiguration('cloudflareImagesUpload');
    const accountId = config.get<string>('accountId');
    const apiToken = config.get<string>('apiToken');
    const accountHash = config.get<string>('accountHash');
    const defaultVariant = config.get<string>('defaultVariant') || '/public';
    const useSignedUrls = config.get<boolean>('useSignedUrls', false);
    const manualSigningKey = config.get<string>('signingKey', '');
    const signedUrlExpiration = config.get<number>('signedUrlExpiration', 0);

    if (!accountId || !apiToken || !accountHash) {
        return null;
    }

    return {
        accountId,
        apiToken,
        accountHash,
        defaultVariant,
        useSignedUrls,
        manualSigningKey,
        signedUrlExpiration
    };
}

async function getCloudflareConfig(): Promise<CloudflareConfig | null> {
    const syncConfig = getCloudflareConfigSync();
    if (!syncConfig) {
        return null;
    }

    let signingKey = '';
    if (syncConfig.useSignedUrls) {
        // Automatically fetch signing key if not manually provided
        const key = await getSigningKey(syncConfig.accountId, syncConfig.apiToken, syncConfig.manualSigningKey);
        if (!key) {
            vscode.window.showErrorMessage('Failed to retrieve signing key from Cloudflare. Please check your API token has Images Read permission, or manually add the signing key in settings.');
            return null;
        }
        signingKey = key;
    }

    return {
        accountId: syncConfig.accountId,
        apiToken: syncConfig.apiToken,
        accountHash: syncConfig.accountHash,
        defaultVariant: syncConfig.defaultVariant,
        useSignedUrls: syncConfig.useSignedUrls,
        signingKey,
        signedUrlExpiration: syncConfig.signedUrlExpiration
    };
}

// Legacy sync version for places that can't be async
function getCloudflareConfigLegacy(): CloudflareConfig | null {
    const syncConfig = getCloudflareConfigSync();
    if (!syncConfig) {
        return null;
    }

    // For legacy sync calls, use cached key or manual key
    let signingKey = syncConfig.manualSigningKey || cachedSigningKey || '';

    return {
        accountId: syncConfig.accountId,
        apiToken: syncConfig.apiToken,
        accountHash: syncConfig.accountHash,
        defaultVariant: syncConfig.defaultVariant,
        useSignedUrls: syncConfig.useSignedUrls,
        signingKey,
        signedUrlExpiration: syncConfig.signedUrlExpiration
    };
}

async function uploadImageToCloudflare(
    imagePath: string, 
    config: CloudflareConfig, 
    fileHash?: string, 
    fileName?: string
): Promise<string | null> {
    let tempCompressedPath: string | null = null;
    
    try {
        // Check if compression is needed
        const compressionConfig = getCompressionConfig();
        const compressionResult = await compressImageIfNeeded(imagePath, compressionConfig);
        
        const uploadPath = compressionResult.path;
        tempCompressedPath = compressionResult.wasCompressed ? compressionResult.path : null;
        
        // Show compression notification if image was compressed
        if (compressionResult.wasCompressed) {
            const originalMB = (compressionResult.originalSize / (1024 * 1024)).toFixed(2);
            const newMB = (compressionResult.newSize / (1024 * 1024)).toFixed(2);
            vscode.window.showInformationMessage(
                `Image compressed: ${originalMB} MB → ${newMB} MB`
            );
        }
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(uploadPath));
        formData.append('requireSignedURLs', config.useSignedUrls ? 'true' : 'false');

        // Add metadata if enabled in settings
        const vsConfig = vscode.workspace.getConfiguration('cloudflareImagesUpload');
        const addMetadata = vsConfig.get<boolean>('addMetadata', true);
        
        if (addMetadata) {
            // Get version from package.json dynamically
            const extensionVersion = vscode.extensions.getExtension('miguelcaetanodias.cloudflare-images-upload')?.packageJSON?.version || 'unknown';
            const metadata = {
                uploadedBy: 'vscode-cloudflare-images-extension',
                version: extensionVersion,
                uploadedAt: new Date().toISOString(),
                fileName: fileName || path.basename(imagePath)
            };
            formData.append('metadata', JSON.stringify(metadata));
        }

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
        
        // Construct the URL (signed or public)
        let imageUrl: string;
        if (config.useSignedUrls) {
            imageUrl = generateSignedUrl(imageId, config.defaultVariant, config);
        } else {
            imageUrl = `https://imagedelivery.net/${config.accountHash}/${imageId}${config.defaultVariant}`;
        }
        
        // Store in cache if hash and fileName are provided
        if (fileHash && fileName) {
            await addImageToCache(fileHash, imageUrl, fileName);
        }
        
        // Clean up temp compressed file
        if (tempCompressedPath) {
            try {
                fs.unlinkSync(tempCompressedPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        
        return imageUrl;
    } catch (error) {
        // Clean up temp compressed file on error
        if (tempCompressedPath) {
            try {
                fs.unlinkSync(tempCompressedPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        vscode.window.showErrorMessage(`Upload failed: ${error}`);
        return null;
    }
}

export function deactivate() {}
