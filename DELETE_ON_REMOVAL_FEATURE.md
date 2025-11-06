# Delete on Removal Feature - Testing Guide

## Overview

This feature allows users to automatically delete images from Cloudflare when they remove the URL from their document. It's **disabled by default** and must be enabled in settings.

## How It Works

1. **Tracking**: When you upload an image, the extension tracks the URL for 5 minutes
2. **Detection**: If you delete/remove the URL within those 5 minutes, the extension detects it
3. **Confirmation**: A dialog asks: "Image URL removed. Delete from Cloudflare Images?"
4. **Action**: Choose "Delete" to remove from Cloudflare, or "Keep" to leave it

## Configuration

**Setting**: `cloudflareImagesUpload.deleteOnRemoval`
- **Type**: Boolean
- **Default**: `false` (disabled)
- **Description**: Ask to delete image from Cloudflare when URL is removed from document

### To Enable:

1. Open Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "Cloudflare Images Upload"
3. Check the box for "Delete On Removal"

## Testing Instructions

### Test 1: Basic Deletion
1. **Enable** the feature in settings
2. Upload an image (drag & drop, paste, or command)
3. **Immediately delete** the inserted URL (select and press Delete or Cmd+Z)
4. **Expected**: Dialog appears asking if you want to delete from Cloudflare
5. Click **"Delete"**
6. **Expected**: Success message, image deleted from Cloudflare

### Test 2: Keep Option
1. Upload an image
2. Delete the URL
3. **Expected**: Dialog appears
4. Click **"Keep"**
5. **Expected**: No deletion, no error messages

### Test 3: Feature Disabled
1. **Disable** the feature in settings
2. Upload an image
3. Delete the URL
4. **Expected**: No dialog, URL just deleted normally

### Test 4: Multiple Images
1. Enable the feature
2. Upload 3 images
3. Delete all 3 URLs
4. **Expected**: 3 separate dialogs (one for each image)

### Test 5: Timeout (After 5 Minutes)
1. Upload an image
2. **Wait 6 minutes**
3. Delete the URL
4. **Expected**: No dialog (tracking expired)

### Test 6: Different Document
1. Upload an image in `file1.md`
2. Copy the URL to `file2.md`
3. Delete the URL from `file2.md`
4. **Expected**: No dialog (only tracks in the original document)

## Technical Details

### Tracking Duration
- **5 minutes** after insertion
- Prevents false positives from old URLs
- Automatically cleaned up after timeout

### URL Detection
- Matches pattern: `https://imagedelivery.net/{accountHash}/{imageId}/{variant}`
- Extracts image ID for deletion API call
- Works with all URL formats (markdown, HTML, plain text)

### Cache Management
- Deleted images are also removed from the duplicate detection cache
- Ensures consistency between Cloudflare and local cache

### API Call
- Uses Cloudflare Images DELETE API
- Endpoint: `DELETE /accounts/{accountId}/images/v1/{imageId}`
- Requires API token with Images:Edit permission

## Limitations

1. **5-minute window**: Only works within 5 minutes of upload
2. **Same document**: Only tracks deletions in the document where it was inserted
3. **Manual confirmation**: Always asks for confirmation (no auto-delete)
4. **One URL at a time**: Dialogs appear sequentially for multiple deletions

## Safety Features

- ✅ **Disabled by default** - Users must opt-in
- ✅ **Confirmation required** - No accidental deletions
- ✅ **Time-limited tracking** - Prevents false positives
- ✅ **Document-specific** - Only tracks in original document
- ✅ **Cache cleanup** - Removes from both Cloudflare and local cache

## Troubleshooting

**Dialog doesn't appear:**
- Check if feature is enabled in settings
- Ensure deletion happens within 5 minutes of upload
- Verify you're deleting from the same document

**Deletion fails:**
- Check API token has Images:Edit permission
- Verify internet connection
- Check Cloudflare dashboard for image existence

**Multiple dialogs:**
- This is expected when deleting multiple images
- Each image gets its own confirmation dialog
