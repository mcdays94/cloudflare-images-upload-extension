# Publishing Guide

This guide will walk you through publishing the Cloudflare Images Upload extension to GitHub and the VSCode Marketplace.

## 📋 Pre-Publishing Checklist

- [x] Extension icon added (`extension_icon.png`)
- [x] README.md updated with comprehensive documentation
- [x] LICENSE file created (MIT)
- [x] .gitignore configured
- [x] package.json metadata complete
- [x] All features tested and working
- [ ] GitHub repository created
- [ ] Extension packaged (.vsix)
- [ ] VSCode Marketplace publisher account created

## 🐙 Part 1: Publishing to GitHub

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the **"+"** icon → **"New repository"**
3. Repository settings:
   - **Name**: `cloudflare-images-upload`
   - **Description**: "VSCode extension to upload images to Cloudflare Images with drag & drop, paste, or command palette"
   - **Visibility**: Public
   - **Initialize**: ❌ Do NOT initialize with README (we already have one)
4. Click **"Create repository"**

### Step 2: Initialize Git and Push

Run these commands in your project directory:

```bash
# Navigate to project directory
cd /Users/miguelcaetanodias/Documents/Projects/cf-images-vs-code-extension/CascadeProjects/windsurf-project/cloudflare-images-upload

# Initialize git repository
git init

# Add all files (testing files will be ignored by .gitignore)
git add .

# Create initial commit
git commit -m "Initial release: Cloudflare Images Upload extension v0.1.0

Features:
- Drag & drop image upload
- Paste from clipboard
- Command palette upload
- Automatic markdown link insertion
- Progress notifications
- Support for PNG, JPG, GIF, WebP, BMP, SVG"

# Add remote repository (replace with your actual repo URL)
git remote add origin https://github.com/miguelcaetanodias/cloudflare-images-upload.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Create a Release on GitHub

1. Go to your repository on GitHub
2. Click **"Releases"** → **"Create a new release"**
3. Release settings:
   - **Tag**: `v0.1.0`
   - **Release title**: `v0.1.0 - Initial Release`
   - **Description**:
     ```markdown
     ## 🎉 Initial Release

     First public release of Cloudflare Images Upload for VSCode!

     ### ✨ Features
     - 🖱️ Drag & drop image upload
     - 📋 Paste from clipboard (screenshots, browsers, editors)
     - ⌨️ Command palette upload
     - 🔗 Automatic markdown link insertion
     - ⚡ Real-time progress notifications
     - 🎯 Smart activation in markdown files only

     ### 📸 Supported Formats
     PNG, JPG, JPEG, GIF, WebP, BMP, SVG

     ### 📦 Installation
     Download the `.vsix` file below and install via VSCode Extensions → Install from VSIX

     ### 🔧 Requirements
     - VSCode 1.80.0+
     - Cloudflare account with Images enabled
     - API token with Images:Edit permission
     ```
4. Attach the `.vsix` file (we'll create this next)
5. Click **"Publish release"**

## 📦 Part 2: Package the Extension

### Step 1: Install VSCE (if not already installed)

```bash
npm install -g @vscode/vsce
```

### Step 2: Package the Extension

```bash
# Make sure you're in the project directory
cd /Users/miguelcaetanodias/Documents/Projects/cf-images-vs-code-extension/CascadeProjects/windsurf-project/cloudflare-images-upload

# Package the extension
vsce package
```

This will create: `cloudflare-images-upload-0.1.0.vsix`

### Step 3: Test the Packaged Extension

1. Open VSCode
2. Go to Extensions (`Cmd+Shift+X`)
3. Click the `...` menu → **"Install from VSIX..."**
4. Select `cloudflare-images-upload-0.1.0.vsix`
5. Test all features to ensure everything works

## 🏪 Part 3: Publishing to VSCode Marketplace

### Step 1: Create a Publisher Account

1. Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft account (or create one)
3. Click **"Create publisher"**
4. Publisher settings:
   - **ID**: `miguelcaetanodias` (must match package.json)
   - **Display name**: Your name or company
   - **Description**: Brief bio
5. Click **"Create"**

### Step 2: Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Click on your profile → **"Security"** → **"Personal access tokens"**
3. Click **"New Token"**
4. Token settings:
   - **Name**: "VSCode Extension Publishing"
   - **Organization**: All accessible organizations
   - **Expiration**: 90 days (or custom)
   - **Scopes**: 
     - ✅ **Marketplace** → **Manage**
5. Click **"Create"**
6. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 3: Login to VSCE

```bash
vsce login miguelcaetanodias
```

When prompted, paste your Personal Access Token.

### Step 4: Publish to Marketplace

```bash
# Publish the extension
vsce publish
```

This will:
1. Package the extension
2. Upload it to the marketplace
3. Make it available for installation

### Step 5: Verify Publication

1. Go to [VSCode Marketplace](https://marketplace.visualstudio.com/)
2. Search for "Cloudflare Images Upload"
3. Verify your extension appears with:
   - Correct icon
   - Correct description
   - README displayed properly
   - All metadata correct

## 🔄 Future Updates

### Publishing Updates

When you make changes and want to publish an update:

1. **Update version** in `package.json`:
   ```json
   "version": "0.2.0"
   ```

2. **Update CHANGELOG** (create CHANGELOG.md if needed)

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "Version 0.2.0: Add new features"
   git push
   ```

4. **Create GitHub release**:
   - Tag: `v0.2.0`
   - Include changelog

5. **Publish to marketplace**:
   ```bash
   vsce publish
   ```

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (0.2.0): New features, backwards compatible
- **Patch** (0.1.1): Bug fixes

## 📊 Post-Publishing

### Monitor Your Extension

1. **Marketplace Dashboard**: https://marketplace.visualstudio.com/manage/publishers/miguelcaetanodias
   - View install count
   - Read reviews
   - Monitor ratings

2. **GitHub Issues**: Monitor for bug reports and feature requests

3. **Analytics**: Track downloads and usage

### Promote Your Extension

- Share on social media
- Write a blog post
- Submit to VSCode extension lists
- Add to your portfolio

## 🆘 Troubleshooting

### "Publisher not found"

Make sure the `publisher` field in `package.json` matches your marketplace publisher ID exactly.

### "Icon not found"

Ensure `extension_icon.png` is in the root directory and referenced correctly in `package.json`.

### "Package failed"

Check for:
- TypeScript compilation errors (`npm run compile`)
- Missing required fields in `package.json`
- Invalid icon format (must be PNG, 128x128 minimum)

### "Authentication failed"

Your Personal Access Token may have expired. Create a new one and login again:
```bash
vsce login miguelcaetanodias
```

## ✅ Success Checklist

After publishing, verify:

- [ ] Extension appears on VSCode Marketplace
- [ ] Icon displays correctly
- [ ] README renders properly
- [ ] Installation works from marketplace
- [ ] All features work after marketplace installation
- [ ] GitHub repository is public and accessible
- [ ] Release is created with .vsix file attached

## 🎉 Congratulations!

Your extension is now published and available to millions of VSCode users worldwide!

---

**Next Steps:**
- Monitor for issues and feedback
- Plan future features
- Engage with users
- Keep the extension updated
