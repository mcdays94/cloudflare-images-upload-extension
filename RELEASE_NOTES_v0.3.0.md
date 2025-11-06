# Release v0.3.0 - Smart Duplicate Detection

## 🎉 What's New

### Smart Duplicate Detection
This release introduces intelligent duplicate detection that automatically identifies when you're uploading the same image again, saving bandwidth and avoiding redundant uploads to Cloudflare!

## ✨ Features

- **🔍 SHA-256 Hash-Based Detection**: Uses cryptographic hashing to identify duplicate images with 100% accuracy
- **💾 Persistent Local Cache**: Stores image hashes in VS Code's global storage (survives restarts)
- **⏰ 30-Day Retention**: Automatically cleans up old cache entries after 30 days
- **🔔 User Notifications**: Shows friendly messages when duplicates are detected
- **⚡ Zero API Calls**: Instant duplicate detection without any network requests
- **🌐 Universal Support**: Works across all upload methods:
  - Drag & drop
  - Paste from clipboard
  - Command palette upload
  - Base64 paste

## 🎯 How It Works

1. When you upload an image, the extension calculates its SHA-256 hash
2. The hash is checked against the local cache
3. If found, the existing Cloudflare URL is reused (no upload!)
4. If not found, the image is uploaded and cached for future use

## 📊 Benefits

- **Save Bandwidth**: No redundant uploads to Cloudflare
- **Faster Workflow**: Instant URL insertion for duplicate images
- **Cost Efficient**: Reduce API calls and storage usage
- **User Friendly**: Automatic with no configuration needed

## 🔧 Technical Details

- Cache stored in: VS Code's `globalState` API
- Hash algorithm: SHA-256
- Cache retention: 30 days (configurable in future releases)
- Storage location: `~/Library/Application Support/Code/User/globalStorage/` (macOS)

## 📦 Installation

### VS Code Marketplace
```bash
ext install miguelcaetanodias.cloudflare-images-upload
```

### Open VSX Registry (for Windsurf, VSCodium)
```bash
# Available at: https://open-vsx.org/extension/miguelcaetanodias/cloudflare-images-upload
```

### Manual Installation
Download the `.vsix` file from this release and install via:
- VS Code: Extensions → `...` → Install from VSIX
- Windsurf: Extensions → `...` → Install from VSIX

## 🐛 Bug Fixes

None in this release.

## 📝 Full Changelog

**Added:**
- Duplicate detection system with SHA-256 hashing
- Local cache management with 30-day retention
- User notifications for duplicate detection
- Cache cleanup on extension activation

**Changed:**
- Updated `uploadImageToCloudflare` to support hash and filename parameters
- Enhanced `processImageFiles` to check cache before uploading

## 🙏 Acknowledgments

Thanks to everyone who tested the extension and provided feedback!

---

**Full Changelog**: https://github.com/mcdays94/cloudflare-images-upload-extension/compare/v0.2.0...v0.3.0
