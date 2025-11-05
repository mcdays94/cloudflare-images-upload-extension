# Testing Guide for Cloudflare Images Upload Extension

This guide will walk you through testing the extension locally before packaging it for distribution.

## Prerequisites

Before testing, ensure you have:

1. **Cloudflare Account** with Images enabled
2. **API Token** with `Images:Edit` permission
3. **Account ID** and **Account Hash** from your Cloudflare dashboard

### Getting Your Cloudflare Credentials

1. **Account ID**: 
   - Go to https://dash.cloudflare.com
   - Select your account
   - Find your Account ID in the right sidebar

2. **Account Hash**:
   - Go to https://dash.cloudflare.com → Images
   - Look at the URL: `https://dash.cloudflare.com/<account-id>/images/images`
   - Or find it in the "Developer Resources" section of the Images dashboard

3. **API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use the "Edit Cloudflare Images" template or create a custom token with `Images:Edit` permission
   - Copy the token (you won't be able to see it again!)

## Step 1: Compile the Extension

```bash
cd cloudflare-images-upload
npm run compile
```

This compiles the TypeScript code to JavaScript in the `out/` directory.

## Step 2: Launch the Extension Development Host

### Option A: Using VSCode UI (Recommended)

1. Open the `cloudflare-images-upload` folder in VSCode
2. Press `F5` or go to **Run → Start Debugging**
3. This will open a new VSCode window titled **"[Extension Development Host]"**

### Option B: Using Command Palette

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type "Debug: Start Debugging" and select it
3. Choose "Run Extension" from the dropdown

## Step 3: Configure the Extension

In the **Extension Development Host** window:

1. Open Settings:
   - `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)
   - Or: File → Preferences → Settings

2. Search for "Cloudflare Images Upload"

3. Enter your credentials:
   - **Account ID**: Your Cloudflare Account ID
   - **API Token**: Your API token with Images:Edit permission
   - **Account Hash**: Your account hash from the Images dashboard
   - **Default Variant**: Leave as `/public` or customize

## Step 4: Test the Extension

### Test 1: Upload via Command Palette

1. Create or open a text file (`.md`, `.txt`, etc.)
2. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Type "Upload Image to Cloudflare" and select it
4. Choose an image file from your computer
5. **Expected Result**: The image should upload and a Markdown link should be inserted at your cursor position

Example output:
```markdown
![image.png](https://imagedelivery.net/YOUR_HASH/IMAGE_ID/public)
```

### Test 2: Paste from Clipboard (if implemented)

1. Copy an image to your clipboard:
   - Take a screenshot
   - Copy an image from a web browser
   - Copy from an image editor

2. Paste into your document (`Ctrl+V` or `Cmd+V`)
3. **Expected Result**: The image should upload and the URL should be inserted

### Test 3: Drag and Drop (if implemented)

1. Open a text file in the Extension Development Host
2. Drag an image file from your file explorer
3. Drop it into the editor
4. **Expected Result**: The image should upload and the URL should be inserted

## Step 5: Verify the Upload

1. Copy the generated URL from your document
2. Open it in a web browser
3. **Expected Result**: Your image should be displayed via Cloudflare Images CDN

Or verify in the Cloudflare Dashboard:
1. Go to https://dash.cloudflare.com → Images
2. You should see your uploaded image in the list

## Step 6: Debug Issues

### View Debug Console

In the **original** VSCode window (not the Extension Development Host):
- Go to **View → Debug Console**
- Check for any error messages or logs

### Common Issues

**Issue**: "Please configure Cloudflare credentials in settings"
- **Solution**: Make sure you've configured all three settings (Account ID, API Token, Account Hash) in the Extension Development Host window

**Issue**: "Failed to upload image: 401 Unauthorized"
- **Solution**: Check that your API token has the correct permissions (Images:Edit)

**Issue**: "Failed to upload image: 404 Not Found"
- **Solution**: Verify your Account ID is correct

**Issue**: Image URL doesn't work
- **Solution**: Check that your Account Hash is correct. It should match the hash in your Images dashboard URL.

**Issue**: Extension doesn't activate
- **Solution**: Check the Debug Console for errors. Make sure the extension compiled successfully.

## Step 7: Test with Different File Types

Test with various image formats:
- PNG files
- JPG/JPEG files
- GIF files
- WebP files

## Step 8: Test Edge Cases

1. **Large files**: Try uploading a large image (5-10 MB)
2. **Multiple uploads**: Upload several images in quick succession
3. **Different file locations**: Test with files from different directories
4. **Special characters**: Test with filenames containing spaces or special characters

## Step 9: Watch Mode (Optional)

For continuous development and testing:

```bash
npm run watch
```

This will automatically recompile when you make changes to the TypeScript files. After making changes:
1. Press `Ctrl+R` (Windows/Linux) or `Cmd+R` (Mac) in the Extension Development Host window to reload the extension

## Step 10: Stop Debugging

When you're done testing:
- Close the Extension Development Host window, or
- Press `Shift+F5` in the original VSCode window, or
- Click the red stop button in the Debug toolbar

## Next Steps

Once you've thoroughly tested the extension:

1. **Package the extension**:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

2. **Install locally**:
   - In VSCode, go to Extensions view (`Ctrl+Shift+X`)
   - Click the "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

3. **Publish to marketplace** (optional):
   ```bash
   vsce publish
   ```

## Tips for Effective Testing

- Test in different file types (Markdown, plain text, etc.)
- Test with different image sizes and formats
- Test error scenarios (invalid credentials, network issues)
- Test the extension with VSCode's different themes and settings
- Keep the Debug Console open to catch any warnings or errors
