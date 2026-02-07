# Release Notes - v0.5.0

## 🎉 What's New

### 🔐 Signed URLs for Variant Protection

Generate signed URLs to prevent unauthorized access to other image variants. When someone gets your image URL, they can no longer change the variant (e.g., `/public` to `/full`) to access different sizes.

**How it works:**
1. Upload an image with signed URLs enabled
2. The URL is signed with HMAC-SHA256 using your Cloudflare signing key
3. Signature is tied to the specific variant in the URL
4. Attempting to change the variant returns 403 Forbidden

**Features:**
- 🔑 **Auto-fetch Signing Key**: The signing key is automatically retrieved from Cloudflare API (no manual copying required)
- ⏱️ **Configurable Expiration**: Set URL expiration time in seconds, or use `0` for non-expiring signed URLs
- 🔧 **Optional Manual Key**: Override with a manual signing key if needed

**Configuration:**
- Setting: `cloudflareImagesUpload.useSignedUrls`
- Default: `false` (disabled)
- Location: Settings → Cloudflare Images Upload

## 🔧 Technical Details

### Signed URL Format
```
https://imagedelivery.net/<hash>/<id>/public?sig=abc123...
```

With expiration:
```
https://imagedelivery.net/<hash>/<id>/public?exp=1738688400&sig=abc123...
```

### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `cloudflareImagesUpload.useSignedUrls` | `false` | Enable signed URL generation |
| `cloudflareImagesUpload.signedUrlExpiration` | `0` | Expiration in seconds (0 = never) |
| `cloudflareImagesUpload.signingKey` | (empty) | Optional manual key override |

## 📦 Installation

### VS Code Marketplace
```
ext install miguelcaetanodias.cloudflare-images-upload
```

### Open VSX Registry
```
ext install miguelcaetanodias.cloudflare-images-upload
```

### Manual Installation
Download the `.vsix` file from this release and install via:
- VS Code: Extensions → ⋯ → Install from VSIX
- Command: `code --install-extension cloudflare-images-upload-0.5.0.vsix`

## 🔄 Upgrading from v0.4.x

No breaking changes. The new signed URLs feature is disabled by default.

## 📝 Full Changelog

https://github.com/mcdays94/cloudflare-images-upload-extension/compare/v0.4.1...v0.5.0

## 🙏 Feedback

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/mcdays94/cloudflare-images-upload-extension/issues)!

Previous Releases:
- [v0.4.0](https://github.com/mcdays94/cloudflare-images-upload-extension/releases/tag/v0.4.0) - Metadata Tagging & Delete on Removal
- [v0.3.0](https://github.com/mcdays94/cloudflare-images-upload-extension/releases/tag/v0.3.0) - Smart Duplicate Detection
- [v0.2.0](https://github.com/mcdays94/cloudflare-images-upload-extension/releases/tag/v0.2.0) - Multi-Format Support
- [v0.1.0](https://github.com/mcdays94/cloudflare-images-upload-extension/releases/tag/v0.1.0) - Initial Release
