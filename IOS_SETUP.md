# iOS App Setup Guide

This guide will help you build and run the Obsidian Notes app on your iPhone.

## Prerequisites

You need the following installed on your Mac:

1. **Xcode** (free from Mac App Store)
   - Version 14.0 or later
   - Includes iOS simulators

2. **Node.js** (if not already installed)
   ```bash
   # Check if installed
   node --version

   # If not installed, download from nodejs.org or use homebrew:
   brew install node
   ```

3. **CocoaPods** (iOS dependency manager)
   ```bash
   sudo gem install cocoapods
   ```

## Step 1: Install Dependencies

Open Terminal in this project folder and run:

```bash
npm install
```

This installs Capacitor and the iOS platform.

## Step 2: Initialize iOS Project

Run this command to create the iOS project:

```bash
npx cap add ios
```

This creates the `ios/` folder with your Xcode project.

## Step 3: Sync Web Assets

Whenever you change your HTML/CSS/JS files, run:

```bash
npx cap sync ios
```

This copies your web files into the iOS app.

## Step 4: Open in Xcode

```bash
npx cap open ios
```

This opens the project in Xcode.

## Step 5: Run on Your iPhone

### First Time Setup:

1. **Connect your iPhone** to your Mac via USB cable
2. In Xcode, click the device dropdown at the top (next to the play button)
3. Select your iPhone from the list
4. **Trust your Mac** on your iPhone when prompted

### Configure Signing:

1. In Xcode, click on "App" in the left sidebar (the blue icon at the top)
2. Under "Signing & Capabilities" tab:
   - Team: Click "Add Account" and sign in with your Apple ID
   - Bundle Identifier: Change if needed (default: `com.winstonoswald.obsidiannotes`)
3. Xcode will automatically create a provisioning profile

### Build and Run:

1. Click the **Play button** (▶️) at the top left, or press `Cmd + R`
2. Xcode builds the app and installs it on your iPhone
3. **First time**: On your iPhone, go to Settings → General → Device Management → Trust the developer

The app will launch on your iPhone!

## Step 6: Rebuilding After Changes

When you update the web code (HTML/JS/CSS):

```bash
# Sync changes to iOS
npx cap sync ios

# Then in Xcode, rebuild (Cmd + R)
```

## Adding iOS-Specific Features

To add native iOS features (like saving to iCloud):

1. Edit `app.js` and add platform detection:
   ```javascript
   const isNativeApp = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
   ```

2. Use Capacitor plugins:
   ```javascript
   import { Filesystem } from '@capacitor/filesystem';

   if (isNativeApp) {
       // iOS-specific code
       await Filesystem.writeFile({
           path: 'notes/file.json',
           data: jsonData,
           directory: Directory.Documents
       });
   }
   ```

## Troubleshooting

### "App expires in 7 days"
- This is normal with free Apple ID
- Just rebuild and reinstall every week
- OR pay $99/year for Apple Developer Program

### "Code Signing Error"
- Make sure you're signed in with your Apple ID in Xcode
- Go to Xcode → Preferences → Accounts

### "Build Failed"
- Try: `cd ios/App && pod install && cd ../..`
- Then rebuild in Xcode

### Web features not working
- Run `npx cap sync ios` to copy latest web files
- Clean build: Product → Clean Build Folder in Xcode

## What Gets Committed to Git

✅ Commit these:
- `package.json`
- `capacitor.config.json`
- `.gitignore`
- `ios/App/App.xcodeproj/` (Xcode project)
- `ios/App/App/` (app configuration)

❌ Don't commit these (in .gitignore):
- `node_modules/`
- `ios/App/Pods/`
- `ios/App/build/`

## Next Steps

Once the basic app works, you can:
1. Add iCloud Drive integration
2. Implement Quick Save feature
3. Submit to TestFlight ($99/year required)
4. Publish to App Store
