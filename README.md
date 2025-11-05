# Cloudflare Images Upload for VSCode

> Upload images to Cloudflare Images with drag & drop, paste, or command palette - automatically insert markdown links.

## ⚠️ Disclaimer

This is an independent, personal project created by the author. While the author is a Cloudflare employee, **this extension is not an official Cloudflare product** and is not affiliated with, endorsed by, or supported by Cloudflare, Inc. This tool was built independently as a side project.

## ✨ Features

- **🖱️ Drag & Drop**: Drag image files from your file explorer directly into markdown files
- **📋 Paste from Clipboard**: Copy images from anywhere (screenshots, browsers, image editors) and paste into your document
- **⌨️ Command Palette**: Use the command palette to select and upload images
- **🔗 Auto Markdown Links**: Automatically inserts properly formatted markdown image links
- **⚡ Progress Notifications**: Real-time upload progress feedback
- **🎯 Markdown-Only**: Smart activation only in markdown files

## 📦 Installation

### From VSCode Marketplace

1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Cloudflare Images Upload"
4. Click Install

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/mcdays94/cloudflare-images-upload-extension/releases)
2. Open VSCode
3. Go to Extensions → `...` menu → Install from VSIX
4. Select the downloaded file

## ⚙️ Configuration

Before using the extension, you need to configure your Cloudflare credentials:

1. Open VSCode Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Cloudflare Images Upload"
3. Configure the following:

| Setting | Description | How to Get It |
|---------|-------------|---------------|
| **Account ID** | Your Cloudflare Account ID | Dashboard → Any domain → Overview (right sidebar) |
| **API Token** | API token with Images:Edit permission | Dashboard → My Profile → API Tokens → Create Token |
| **Account Hash** | Your Cloudflare Images account hash | Dashboard → Images → Copy from URL: `/images/[HASH]` |
| **Default Variant** | Image variant for URLs (optional) | Default: `/public` |

### Getting Your API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on your profile → API Tokens
3. Click "Create Token"
4. Use the "Edit Cloudflare Images" template
5. Or create a custom token with `Account.Cloudflare Images:Edit` permission
6. Copy the token and paste it in the extension settings

## 🚀 Usage

### Method 1: Drag & Drop

1. Open a markdown file (`.md`)
2. Drag an image file from your file explorer
3. Drop it where you want the image
4. ✨ Done! The image uploads and a markdown link is inserted

### Method 2: Paste from Clipboard

1. Copy an image to your clipboard:
   - Take a screenshot (`Cmd+Shift+4` on Mac, `Win+Shift+S` on Windows)
   - Copy an image from a browser (right-click → Copy Image)
   - Copy from an image editor
2. Open a markdown file
3. Paste (`Ctrl+V` or `Cmd+V`)
4. ✨ Done! The image uploads and a markdown link is inserted

### Method 3: Command Palette

1. Open a markdown file
2. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Type "Upload Image to Cloudflare"
4. Select an image file
5. ✨ Done! The image uploads and a markdown link is inserted

## 📸 Supported Image Formats

- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)
- BMP (`.bmp`)
- SVG (`.svg`)

## 🔧 Requirements

- **VSCode**: Version 1.80.0 or higher
- **Cloudflare Account**: With Cloudflare Images enabled
- **API Token**: With `Images:Edit` permission

## 📝 Example Output

When you upload an image, the extension automatically inserts a markdown link:

```markdown
![image-name.png](https://imagedelivery.net/YOUR_HASH/IMAGE_ID/public)
```

The image is immediately accessible via Cloudflare's global CDN!

## 🎯 Use Cases

- **Documentation**: Quickly add screenshots to your README files
- **Blog Posts**: Upload images while writing markdown blog posts
- **Notes**: Add images to your markdown notes
- **Technical Writing**: Include diagrams and screenshots in technical docs
- **GitHub Issues**: Upload images for bug reports

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/mcdays94/cloudflare-images-upload-extension.git
cd cloudflare-images-upload-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npm run package
```

### Project Structure

```
cloudflare-images-upload/
├── src/
│   └── extension.ts       # Main extension code
├── out/                   # Compiled JavaScript
├── extension_icon.png     # Extension icon
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
└── README.md            # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📮 Support

- **Issues**: [GitHub Issues](https://github.com/mcdays94/cloudflare-images-upload-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mcdays94/cloudflare-images-upload-extension/discussions)

## 📊 Release Notes

### 0.1.0 (Initial Release)

- ✅ Drag & drop image upload
- ✅ Paste image from clipboard
- ✅ Command palette upload
- ✅ Automatic markdown link insertion
- ✅ Progress notifications
- ✅ Support for PNG, JPG, GIF, WebP, BMP, SVG

---

Made with ❤️ by [Miguel Caetano Dias](https://github.com/mcdays94)
