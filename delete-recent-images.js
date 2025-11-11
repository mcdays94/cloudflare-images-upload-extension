#!/usr/bin/env node

/**
 * Delete Cloudflare Images uploaded in the last 7 days
 * 
 * Usage:
 *   node delete-recent-images.js
 * 
 * Required environment variables:
 *   CF_ACCOUNT_ID - Your Cloudflare Account ID
 *   CF_API_TOKEN - Your Cloudflare API Token with Images:Edit permission
 */

const fetch = require('node-fetch');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const DAYS_AGO = 7;

if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('❌ Error: Missing required environment variables');
    console.error('Please set CF_ACCOUNT_ID and CF_API_TOKEN');
    process.exit(1);
}

async function listImages() {
    console.log('📋 Fetching all images...');
    
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
        {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list images: ${error}`);
    }

    const data = await response.json();
    return data.result.images || [];
}

async function deleteImage(imageId) {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1/${imageId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete image ${imageId}: ${error}`);
    }

    return true;
}

async function main() {
    try {
        // Calculate cutoff date (7 days ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DAYS_AGO);
        console.log(`🗓️  Cutoff date: ${cutoffDate.toISOString()}`);
        console.log(`   (Deleting images uploaded after this date)\n`);

        // Fetch all images
        const images = await listImages();
        console.log(`📊 Total images in account: ${images.length}\n`);

        // Filter images uploaded in the last 7 days
        const recentImages = images.filter(img => {
            const uploadedAt = new Date(img.uploaded);
            return uploadedAt > cutoffDate;
        });

        if (recentImages.length === 0) {
            console.log('✅ No images found from the last 7 days');
            return;
        }

        console.log(`🎯 Found ${recentImages.length} image(s) to delete:\n`);
        
        // Show images that will be deleted
        recentImages.forEach((img, index) => {
            console.log(`${index + 1}. ID: ${img.id}`);
            console.log(`   Uploaded: ${img.uploaded}`);
            console.log(`   Filename: ${img.filename || 'N/A'}`);
            if (img.meta && img.meta.fileName) {
                console.log(`   Original: ${img.meta.fileName}`);
            }
            console.log('');
        });

        // Ask for confirmation
        console.log('⚠️  WARNING: This action cannot be undone!');
        console.log('Press Ctrl+C to cancel, or press Enter to continue...');
        
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });

        // Delete images
        console.log('\n🗑️  Deleting images...\n');
        let successCount = 0;
        let failCount = 0;

        for (const img of recentImages) {
            try {
                await deleteImage(img.id);
                console.log(`✅ Deleted: ${img.id} (${img.filename || 'N/A'})`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed: ${img.id} - ${error.message}`);
                failCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Successfully deleted: ${successCount}`);
        console.log(`   ❌ Failed: ${failCount}`);
        console.log(`   📈 Total processed: ${recentImages.length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
